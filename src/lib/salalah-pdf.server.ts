import "@tanstack/react-start/server-only";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { PDFDocument, rgb, type PDFFont } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import sharp from "sharp";
import type { ExtractedReport } from "./report.types";
import { validateReport } from "./report.types";
import { reportDate } from "./report-dates";
import { coverCrop, photoPresentation } from "./image-fit";
import { headerLogoLayout } from "./header-logos";

type Box = [number, number, number, number];
type Cell = {
  x: number;
  right: number;
  baseline: number;
  size: number;
  font: string;
  color: number;
};
type Geometry = {
  width: number;
  height: number;
  boxes: Record<string, Box>;
  cells: Record<string, Cell[]>;
  activities: number[];
};
const absent = (v: string) =>
  !v.trim() || /^(not provided|not reported|n\/?a|[-—])$/i.test(v.trim());
const number = (v: number | null, digits = 2) => (v == null ? "—" : v.toFixed(digits));
const value = (v: string) => (absent(v) ? "—" : v);
const contactLine = (name: string, role: string, phone: string) =>
  [
    value(name),
    !absent(role) && !name.toLowerCase().includes(role.toLowerCase()) ? `(${role})` : "",
    value(phone),
  ]
    .filter(Boolean)
    .join(" ");
const money = (v: number | null) =>
  v == null
    ? "—"
    : v.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 });

/** Generate from a sanitized master: original project text/images are removed, never overlaid. */
export async function buildSalalahPdf(r: ExtractedReport): Promise<Uint8Array> {
  const issues = validateReport(r, { skipSchedule: r.printChartMode === "image" }).filter(
    (s) => !/schematic|project route|dashboard logo/i.test(s),
  );
  if (!r.printClientLogo)
    issues.push(
      "Upload the client/ministry logo for the PDF header (separate from the dashboard logo).",
    );
  if (!/^(ro|omr)$/i.test(r.currency.replace(/[.\s]/g, "")))
    issues.push(
      "This exact master prints R.O. currency labels. A different currency requires an approved template revision.",
    );
  if (r.layoutImageSource !== "original")
    issues.push("Upload the project map for the upper PDF panel.");
  if (!r.activityStatusImage)
    issues.push("Upload the activity-status drawing for the lower PDF panel.");
  if (reportDate(r.dataAsOf) == null)
    issues.push("Set a valid Data as of date for the PDF heading.");
  if (r.activities.length > 13)
    issues.push(
      "The exact PDF design has 13 activity rows. Review grouping; additional rows cannot be silently clipped.",
    );
  if (r.printChartMode === "image" && !r.printChartImage)
    issues.push("Upload the original S-curve image for the PDF, or select a generated chart.");
  if (r.printChartMode !== "image" && r.schedule.length > 36)
    issues.push(
      "The exact PDF S-curve table supports at most 36 monthly columns at its approved print size.",
    );
  if (r.contractRows.length && r.contractRows.length !== 7)
    issues.push("The PDF contract table requires its seven original/contingency/variation rows.");
  if (
    r.financialPlannedProgress != null &&
    r.financialDifference != null &&
    Math.abs(r.financialProgress - r.financialPlannedProgress - r.financialDifference) > 0.02
  )
    issues.push(
      "For this PDF, financial difference must equal actual minus planned. Review the sign and source values.",
    );
  if (issues.length) throw new Error(issues.join("\n"));
  const root = resolve(process.cwd(), "templates/salalah");
  const g = JSON.parse(await readFile(resolve(root, "geometry.json"), "utf8")) as Geometry;
  const masterBytes = await readFile(resolve(root, "master-classic.pdf"));
  const doc = await PDFDocument.load(masterBytes);
  const sourceMaster = await PDFDocument.load(masterBytes);
  doc.registerFontkit(fontkit);
  const fonts: Record<string, PDFFont> = {};
  for (const name of ["F1", "F2", "F3", "F4", "F5"])
    fonts[name] = await doc.embedFont(await readFile(resolve(root, name + ".ttf")), {
      subset: true,
    });
  const page = doc.getPages()[0]!;
  const failures: string[] = [];
  function line(
    text: string,
    x: number,
    baseline: number,
    width: number,
    size: number,
    font = "F4",
    align: "left" | "center" = "center",
    color = 0x0f1b26,
  ) {
    const f = fonts[font]!;
    // Reject missing glyphs and overflow instead of silently shrinking or replacing characters.
    const chars = new Set(f.getCharacterSet());
    if ([...text].some((c) => !chars.has(c.codePointAt(0)!))) {
      failures.push(`Unsupported character in "${text.slice(0, 70)}".`);
      return;
    }
    const w = f.widthOfTextAtSize(text, size);
    if (w > width + 0.3) {
      failures.push(`Text does not fit its fixed PDF cell: "${text.slice(0, 90)}".`);
      return;
    }
    page.drawText(text, {
      x: x + (align === "center" ? (width - w) / 2 : 0),
      y: g.height - baseline,
      size,
      font: f,
      color: rgb(((color >> 16) & 255) / 255, ((color >> 8) & 255) / 255, (color & 255) / 255),
    });
  }
  function block(
    key: string,
    text: string,
    size: number,
    font: string,
    leading: number,
    align: "left" | "center" = "left",
    color = 0x0f1b26,
  ) {
    const b = g.boxes[key]!;
    const width = b[2] - b[0];
    const lines: string[] = [];
    for (const paragraph of text.split(/\r?\n/)) {
      let current = "";
      for (const word of paragraph.split(/\s+/).filter(Boolean)) {
        const next = current ? current + " " + word : word;
        if (current && fonts[font]!.widthOfTextAtSize(next, size) > width) {
          lines.push(current);
          current = word;
        } else current = next;
      }
      lines.push(current);
    }
    if (lines.length * leading > b[3] - b[1] + 1) {
      failures.push(
        `${key}: ${lines.length} lines do not fit the fixed PDF area. Shorten the text; the design will not be resized.`,
      );
      return;
    }
    lines.forEach((t, i) =>
      line(t, b[0], b[1] + size + i * leading, width, size, font, align, color),
    );
  }
  function group(key: string, values: string[]) {
    g.cells[key]!.forEach((c, i) =>
      line(values[i] ?? "—", c.x, c.baseline, c.right - c.x, c.size, c.font, "center", c.color),
    );
  }
  async function image(key: string, url: string, photo?: Parameters<typeof photoPresentation>[0]) {
    const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=\r\n]+)$/.exec(url);
    if (!match) throw new Error(`${key}: upload a PNG, JPG or WebP image.`);
    const bytes = Buffer.from(match[2]!, "base64");
    if (!bytes.length || bytes.length > 15 * 1024 * 1024)
      throw new Error(`${key}: image exceeds 15 MB.`);
    const decoded = sharp(bytes, { limitInputPixels: 50_000_000, failOn: "error" });
    const meta = await decoded.metadata();
    if ((meta.pages ?? 1) > 1) throw new Error(`${key}: animated images are not supported.`);
    const b = g.boxes[key]!;
    // Normalize phone EXIF orientation before calculating crops; never stretch a source.
    const oriented = await decoded.rotate().toBuffer({ resolveWithObject: true });
    let pipeline = sharp(oriented.data, { limitInputPixels: 50_000_000 });
    if (photo && photoPresentation(photo).fit === "cover") {
      const position = photoPresentation(photo);
      pipeline = pipeline.extract(
        coverCrop(
          oriented.info.width,
          oriented.info.height,
          (b[2] - b[0]) / (b[3] - b[1]),
          position.x,
          position.y,
        ),
      );
    }
    const embedded = await doc.embedPng(
      await pipeline
        .resize({
          width: Math.ceil((b[2] - b[0]) * 4),
          height: Math.ceil((b[3] - b[1]) * 4),
          fit: "inside",
          withoutEnlargement: true,
        })
        .png()
        .toBuffer(),
    );
    const scale = Math.min((b[2] - b[0]) / embedded.width, (b[3] - b[1]) / embedded.height);
    const w = embedded.width * scale,
      h = embedded.height * scale;
    page.drawImage(embedded, {
      x: b[0] + (b[2] - b[0] - w) / 2,
      y: g.height - b[3] + (b[3] - b[1] - h) / 2,
      width: w,
      height: h,
    });
  }
  block("client", r.clientName.toUpperCase(), 9.48, "F1", 11.4, "left", 0x05538f);
  block("department", r.clientDepartment.toUpperCase(), 7.08, "F1", 8.2, "left", 0x05538f);
  if (
    r.printTitle &&
    r.printTitle.replace(/\s+/g, " ").trim().toUpperCase() !==
      r.projectName.replace(/\s+/g, " ").trim().toUpperCase()
  )
    failures.push("PDF title wording must match the project name; only line breaks may differ.");
  block("title", (r.printTitle || r.projectName).toUpperCase(), 9.48, "F2", 11.4, "center");
  const date = new Date(reportDate(r.dataAsOf)!);
  const day = date.getUTCDate(),
    suffix =
      day % 100 >= 11 && day % 100 <= 13
        ? "th"
        : (({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[day % 10] ?? "th");
  const prefix = `on ${day}`,
    rest = ` ${date.toLocaleString("en-GB", { month: "long", timeZone: "UTC" })} ${date.getUTCFullYear()}`;
  const dw = fonts["F3"]!.widthOfTextAtSize(prefix, 13.44),
    sw = fonts["F3"]!.widthOfTextAtSize(suffix, 8.88),
    rw = fonts["F3"]!.widthOfTextAtSize(rest, 13.44);
  const dx = 438 + (145 - dw - sw - rw) / 2;
  line(prefix, dx, 65.52, dw + 0.1, 13.44, "F3", "left");
  line(suffix, dx + dw, 61.68, sw + 0.1, 8.88, "F3", "left");
  line(rest, dx + dw + sw, 65.52, rw + 0.1, 13.44, "F3", "left");
  block("brief", r.brief, 8.28, "F5", 9.96);
  const originalLabels = [
    "Original contract (No Cont.)",
    "Contingency",
    "Original contract (with Cont.)",
    "Contract (with VO.1)",
    "Contract (with VO.2)",
    "Contract (with VO.3 & Cont.)",
    "Contract (with VO.4 & Cont.)",
  ];
  if (r.contractRows.length) {
    originalLabels.forEach((label, i) => {
      if (
        r.contractRows[i]!.label.replace(/\s/g, "").toLowerCase() !==
        label.replace(/\s/g, "").toLowerCase()
      )
        failures.push(`Contract row ${i + 1} must be "${label}" for this fixed template.`);
    });
  }
  group(
    "contract",
    r.contractRows.length
      ? r.contractRows.map((c) => (/^not provided$/i.test(c.value) ? "—" : c.value))
      : Array(7).fill("—"),
  );
  group("dates", [
    r.awardDate,
    `${r.mobilizationDays} Days`,
    `${r.constructionDays} Days`,
    r.startDate,
    r.completionDate,
    value(r.constructionDaysWithVos),
    value(r.completionDateWithVos),
    `${r.elapsedDays} Days`,
    `${number((r.elapsedDays / r.constructionDays) * 100)} %`,
    `${r.remainingDays} Days`,
    value(r.expectedCompletionDate),
  ]);
  group("physical", [
    number(r.monthPlannedProgress),
    number(r.monthActualProgress),
    number(r.plannedProgress),
    number(r.actualProgress),
    number(r.actualProgress - r.plannedProgress),
  ]);
  group("financial", [
    number(r.financialPlannedProgress, 3),
    number(r.financialProgress, 3),
    number(
      r.financialPlannedProgress == null ? null : r.financialProgress - r.financialPlannedProgress,
      3,
    ),
    money(r.paidAmount),
  ]);
  group("machinery", [
    String(r.plannedMachinery),
    String(r.actualMachinery),
    String(r.actualMachinery - r.plannedMachinery),
  ]);
  group("manpower", [
    String(r.plannedManpower),
    String(r.actualManpower),
    String(r.actualManpower - r.plannedManpower),
  ]);
  r.activities.forEach((a, i) => {
    const y = g.activities[i]!;
    line(a.name, 11.28, y, 91, 7.08, "F4", "left");
    const mobilization = /^mobilization$/i.test(a.name);
    const progress = (v: number | null) => (v == null ? "" : mobilization ? `${v}%` : number(v));
    line(progress(a.planned), 104, y, 26, 7.08);
    line(progress(a.actual), 133, y, 26, 7.08);
    line(
      a.diff == null
        ? ""
        : mobilization
          ? `${a.diff}%`
          : `${a.diff > 0 ? "+" : ""}${number(a.diff)}`,
      162,
      y,
      33,
      7.08,
    );
  });
  line(r.consultantName, 12.48, 793.79, 181.52, 8.64, "F3", "left");
  line(
    contactLine(r.consultantRepresentative, r.consultantRole, r.consultantPhone),
    12.48,
    804.13,
    181.52,
    7.92,
    "F3",
    "left",
  );
  g.boxes["engineer"] = [205, 785.65, 300, 809];
  block("engineer", `${r.engineerName} - ${r.engineerPhone}`, 7.92, "F3", 9.48, "center");
  line(r.contractorName, 307.44, 794.87, 139.56, 8.28, "F3", "left");
  line(
    contactLine(r.contractorRepresentative, r.contractorRole, r.contractorPhone),
    307.44,
    804.49,
    139.56,
    7.08,
    "F3",
    "left",
  );
  for (let i = 0; i < 4; i++) {
    group(`caption${i + 1}`, [r.photos[i]!.caption]);
    await image(`photo${i + 1}`, r.photos[i]!.dataUrl, r.photos[i]!);
  }
  await image("clientLogo", r.printClientLogo);
  await image("map", r.layoutImage, {
    fit: r.printMapFit ?? "contain",
    focalX: r.printMapX,
    focalY: r.printMapY,
  });
  await image("status", r.activityStatusImage);
  page.drawRectangle({
    x: 10,
    y: g.height - 470,
    width: 188,
    height: 17,
    color: rgb(5 / 255, 83 / 255, 143 / 255),
  });
  block(
    "chartTitle",
    `Project Physical Progress Chart/S-Curve(${value(r.revision)})`,
    8.64,
    "F3",
    10.5,
    "center",
    0xffffff,
  );
  if (r.printChartMode === "image") {
    await image("chart", r.printChartImage);
  } else {
    // Native vector S-curve, optional when verified monthly data is available.
    const b = g.boxes["chart"]!,
      left = b[0] + 9,
      top = b[1] + 29,
      w = b[2] - left - 3,
      h = b[3] - top - 12;
    const count = r.schedule.length,
      cw = (b[2] - b[0] - 23) / count;
    const table = [
      r.schedule.map((s) => s.month),
      r.schedule.map((s) => number(s.plannedMonthly)),
      r.schedule.map((s) => number(s.actualMonthly)),
      r.schedule.map((s) => number(s.plannedCumulative)),
      r.schedule.map((s) => number(s.actualCumulative)),
    ];
    table.forEach((row, j) => {
      line(
        ["Month", "Plan/mo", "Actual/mo", "Plan/cum", "Actual/cum"][j]!,
        b[0],
        b[1] + 4 + j * 4.5,
        23,
        3,
        "F5",
        "left",
      );
      row.forEach((v, i) =>
        line(v, b[0] + 23 + i * cw, b[1] + 4 + j * 4.5, cw, Math.min(3, cw / 3), "F5"),
      );
    });
    const drawLine = (
      x1: number,
      y1: number,
      x2: number,
      y2: number,
      color = 0x999999,
      thickness = 0.3,
    ) =>
      page.drawLine({
        start: { x: x1, y: g.height - y1 },
        end: { x: x2, y: g.height - y2 },
        color: rgb(((color >> 16) & 255) / 255, ((color >> 8) & 255) / 255, (color & 255) / 255),
        thickness,
      });
    for (const pct of [0, 25, 50, 75, 100]) {
      const y = top + h * (1 - pct / 100);
      drawLine(left, y, left + w, y, 0xdddddd);
      line(String(pct), b[0], y + 1, 8, 3, "F5");
    }
    const x = (i: number) => left + (i * w) / (count - 1),
      y = (v: number) => top + h * (1 - v / 100);
    for (const [key, color] of [
      ["plannedCumulative", 0xe32420],
      ["actualCumulative", 0x005a9c],
    ] as const)
      r.schedule.forEach((s, i) => {
        const prev = r.schedule[i - 1]?.[key],
          v = s[key];
        if (i && prev != null && v != null) drawLine(x(i - 1), y(prev), x(i), y(v), color, 0.7);
      });
    const maxMonthly = Math.max(
      1,
      ...r.schedule.map((s) => Math.max(s.plannedMonthly, s.actualMonthly ?? 0)),
    );
    r.schedule.forEach((s, i) => {
      for (const [v, color, offset] of [
        [s.plannedMonthly, 0x80a9dd, -1],
        [s.actualMonthly, 0x80c080, 1],
      ] as const)
        if (v != null)
          drawLine(
            x(i) + offset,
            top + h,
            x(i) + offset,
            top + h - (v / maxMonthly) * 18,
            color,
            1.2,
          );
      if (i % Math.max(1, Math.ceil(count / 10)) === 0)
        line(s.month, Math.max(b[0], Math.min(b[2] - 16, x(i) - 8)), top + h + 6, 16, 3, "F5");
    });
  }
  for (const [x1, y1, x2, y2] of [
    [372.96, 758.16, 450, 775.44],
    [201, 545.7, 452, 564],
  ] as const) {
    const fragment = await doc.embedPage(sourceMaster.getPages()[0]!, {
      left: x1,
      bottom: g.height - y2,
      right: x2,
      top: g.height - y1,
    });
    page.drawPage(fragment, { x: x1, y: g.height - y2, width: x2 - x1, height: y2 - y1 });
  }
  if (failures.length)
    throw new Error("PDF layout check failed:\n" + [...new Set(failures)].join("\n"));
  doc.setTitle(`${r.projectName} — ${r.reportMonth}`);
  doc.setSubject("VIA Classic — generated report requires review");
  if (r.headerLogos?.length) {
    const layout = headerLogoLayout(r.headerLogos.length, g.width);
    const output = await PDFDocument.create();
    const finalPage = output.addPage([g.width, g.height]);
    // Finalize pending font/image embeddings before copying into the outer header page.
    const [reportPage] = await output.embedPdf(await doc.save(), [0]);
    const scale = (g.height - layout.height - 12) / g.height;
    finalPage.drawPage(reportPage!, {
      x: (g.width - g.width * scale) / 2,
      y: 6,
      width: g.width * scale,
      height: g.height * scale,
    });
    let totalBytes = 0;
    for (const [index, logo] of r.headerLogos.entries()) {
      const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=\r\n]+)$/.exec(logo.dataUrl);
      if (!match) throw new Error(`Header logo ${index + 1}: upload a PNG, JPG or WebP image.`);
      const bytes = Buffer.from(match[2]!, "base64");
      totalBytes += bytes.length;
      if (!bytes.length || bytes.length > 2 * 1024 * 1024 || totalBytes > 12 * 1024 * 1024)
        throw new Error("Header logos must be under 2 MB each and 12 MB combined.");
      const decoder = sharp(bytes, { limitInputPixels: 50_000_000, failOn: "error" });
      if (((await decoder.metadata()).pages ?? 1) > 1)
        throw new Error("Animated header logos are not supported.");
      const box = layout.boxes[index]!;
      const image = await output.embedPng(
        await decoder
          .rotate()
          .resize({
            width: Math.ceil(box.width * 4),
            height: Math.ceil(box.height * 4),
            fit: "inside",
            withoutEnlargement: true,
          })
          .png()
          .toBuffer(),
      );
      const ratio = Math.min(box.width / image.width, box.height / image.height);
      const width = image.width * ratio,
        height = image.height * ratio;
      finalPage.drawImage(image, {
        x: box.x + (box.width - width) / 2,
        y: g.height - box.top - (box.height + height) / 2,
        width,
        height,
      });
    }
    output.setTitle(doc.getTitle()!);
    output.setSubject("Salalah report with manually uploaded header logos — requires review");
    return output.save();
  }
  return doc.save();
}
