import { randomBytes, randomUUID, scryptSync } from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { manualSource } from "./manual-report";
import { reportSchema, validateReport, type ExtractedReport } from "./report.types";
import { requireAdmin } from "./admin-auth.server";
import { credentialVersion, issueToken, verifyToken } from "./session-token";

async function verifyImages(report: ExtractedReport) {
  const { default: sharp } = await import("sharp");
  const entries = [
    {
      label: "Logo",
      url: report.logoImage,
      width: report.logoImageWidth,
      height: report.logoImageHeight,
    },
    ...(report.layoutImageSource === "original" && report.layoutImage
      ? [
          {
            label: "Layout reference",
            url: report.layoutImage,
            width: report.layoutImageWidth,
            height: report.layoutImageHeight,
          },
        ]
      : []),
    ...report.photos.map((p, i) => ({
      label: `Photo ${i + 1}`,
      url: p.dataUrl,
      width: p.width,
      height: p.height,
    })),
    ...report.attachments.map((p) => ({
      label: p.label,
      url: p.dataUrl,
      width: p.width,
      height: p.height,
    })),
    ...(report.activityStatusImage
      ? [{ label: "Activity-status drawing", url: report.activityStatusImage, width: 0, height: 0 }]
      : []),
  ];
  for (const image of entries) {
    const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=\r\n]+)$/.exec(image.url);
    if (!match) throw new Error(`${image.label}: upload a JPG, PNG or WebP file.`);
    const bytes = Buffer.from(match[2]!, "base64");
    if (!bytes.length || bytes.length > 15 * 1024 * 1024)
      throw new Error(`${image.label}: file exceeds the 15 MB limit.`);
    const decoded = sharp(bytes, { limitInputPixels: 50_000_000, failOn: "error" });
    const meta = await decoded.metadata();
    if (meta.format !== match[1] || (meta.pages ?? 1) > 1)
      throw new Error(`${image.label}: invalid or animated image.`);
    if (image.width && (meta.width !== image.width || meta.height !== image.height))
      throw new Error(`${image.label}: dimensions do not match the uploaded file.`);
    await decoded.stats(); // Decode pixels; metadata alone cannot establish file integrity.
  }
}

export const previewProjectReport = createServerFn({ method: "POST" })
  .validator((input: unknown) => reportSchema.parse(input))
  .handler(async ({ data }) => {
    requireAdmin();
    setResponseHeader("Cache-Control", "private, no-store");
    const issues = validateReport(data);
    if (issues.length) throw new Error(issues.join(" "));
    await verifyImages(data);
    const { buildExactDashboardHtml } = await import("./dashboard-html.server");
    return {
      html: await buildExactDashboardHtml(data),
      token: issueToken("report-preview", credentialVersion(JSON.stringify(data))),
    };
  });

export const generateSalalahPdf = createServerFn({ method: "POST" })
  .validator((input: unknown) => reportSchema.parse(input))
  .handler(async ({ data }) => {
    requireAdmin();
    setResponseHeader("Cache-Control", "private, no-store");
    const { buildSalalahPdf } = await import("./salalah-pdf.server");
    return { base64: Buffer.from(await buildSalalahPdf(data)).toString("base64") };
  });

const publishSchema = z.object({
  clientPassword: z.string().min(8).max(200),
  report: reportSchema,
  sourceBase64: z.string().min(1).max(3_000_000),
  sourceFileName: z.string().min(1).max(200),
  sourceContentType: z.enum(["text/csv", "application/json"]),
  approved: z.literal(true),
  previewToken: z.string(),
  replaceExisting: z.boolean(),
});
export const publishProjectReport = createServerFn({ method: "POST" })
  .validator((input: unknown) => publishSchema.parse(input))
  .handler(async ({ data }) => {
    requireAdmin();
    const { requireActiveProject } = await import("./project-deletion.server");
    await requireActiveProject(data.report.slug);
    if (
      !verifyToken(
        data.previewToken,
        "report-preview",
        credentialVersion(JSON.stringify(data.report)),
      )
    )
      throw new Error("Preview this exact report again before approving publication.");
    const issues = validateReport(data.report);
    if (issues.length) throw new Error(issues.join(" "));
    await verifyImages(data.report);
    const match = /^data:[^,]*;base64,([A-Za-z0-9+/=\r\n]+)$/.exec(data.sourceBase64);
    if (!match) throw new Error("Invalid source CSV upload.");
    const source = Buffer.from(match[1]!, "base64");
    if (
      source.toString("utf8").replace(/^\uFEFF/, "") !==
      (data.sourceContentType === "text/csv"
        ? data.report.rawOcrText.replace(/^\uFEFF/, "")
        : manualSource(data.report))
    )
      throw new Error(
        "Source CSV does not match the imported draft. Re-import the correct source file.",
      );
    if (source.length > 2 * 1024 * 1024) throw new Error("CSV exceeds the 2 MB limit.");
    const salt = randomBytes(16).toString("hex");
    const passwordHash = `${salt}:${scryptSync(data.clientPassword, salt, 64).toString("hex")}`;
    const { saveRevision } = await import("./revision-store.server");
    await saveRevision({
      project: {
        id: randomUUID(),
        slug: data.report.slug,
        name: data.report.projectName,
        domain: `/${data.report.slug}`,
        region: data.report.region,
        status: "active",
        summary: `${data.report.reportMonth} project status dashboard.`,
        brief: data.report.brief,
        metric_1_label: "Physical progress",
        metric_1_value: `${data.report.actualProgress.toFixed(2)}%`,
        metric_2_label: "Financial progress",
        metric_2_value: `${data.report.financialProgress.toFixed(2)}%`,
      },
      report: data.report,
      passwordHash,
      source,
      sourceFileName: data.sourceFileName,
      replaceExisting: data.replaceExisting,
    });
    return { slug: data.report.slug };
  });
