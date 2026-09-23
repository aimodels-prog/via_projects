import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { internalIdentity, requireInternal } from "./internal-auth.server";
import {
  approveInternalSnapshot,
  listInternalSnapshots,
  readInternalSnapshot,
  saveInternalDraft,
} from "./internal-store.server";
import { sumKnownMoney } from "./internal.types";

export const getInternalAccess = createServerFn({ method: "GET" }).handler(async () => ({
  authorized: Boolean(await internalIdentity()),
}));
export const getInternalSnapshots = createServerFn({ method: "GET" }).handler(async () => {
  await requireInternal();
  return listInternalSnapshots();
});
export const getInternalSnapshot = createServerFn({ method: "GET" })
  .validator((v: unknown) => z.object({ id: z.string().uuid() }).parse(v))
  .handler(async ({ data }) => {
    await requireInternal();
    return readInternalSnapshot(data.id);
  });
export const importInternalWorkbook = createServerFn({ method: "POST" })
  .validator((v: unknown) =>
    z
      .object({
        fileName: z
          .string()
          .min(1)
          .max(180)
          .regex(/\.xlsx$/i),
        asOf: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        base64: z
          .string()
          .min(1)
          .max(14_000_000)
          .regex(/^[A-Za-z0-9+/]+={0,2}$/),
      })
      .parse(v),
  )
  .handler(async ({ data }) => {
    const actor = await requireInternal();
    const bytes = Buffer.from(data.base64, "base64");
    const { parseInternalWorkbook } = await import("./internal-excel.server");
    const report = await parseInternalWorkbook(bytes, data.asOf);
    return saveInternalDraft(report, data.fileName, bytes, actor);
  });
export const approveInternalImport = createServerFn({ method: "POST" })
  .validator((v: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        sha256: z.string().regex(/^[a-f0-9]{64}$/),
        reviewed: z.literal(true),
      })
      .parse(v),
  )
  .handler(async ({ data }) => {
    const actor = await requireInternal();
    return approveInternalSnapshot(data.id, actor, data.sha256);
  });
function csvValue(value: string) {
  const safe = /^[\s]*[=+@-]/.test(value) ? `'${value}` : value;
  return `"${safe.replaceAll('"', '""')}"`;
}
export const exportInternalOverview = createServerFn({ method: "POST" })
  .validator((v: unknown) => z.object({ id: z.string().uuid() }).parse(v))
  .handler(async ({ data }) => {
    await requireInternal();
    const s = await readInternalSnapshot(data.id);
    if (s.state !== "approved") throw new Error("Approve the reviewed snapshot before exporting.");
    const rows = [
      ["CONFIDENTIAL — VIA INTERNAL", s.asOf],
      [
        "Project",
        "Code",
        "Country",
        "Currency",
        "VIA contract value",
        "Invoiced OMR (known)",
        "Outstanding OMR (known)",
        "Unbilled OMR (known)",
        "Retention (unconfirmed; excluded)",
      ],
    ];
    for (const p of s.report.projects) {
      const invoices = s.report.invoices.filter(
        (i) => i.projectId === p.id && i.period && i.period <= s.asOf.slice(0, 7),
      );
      rows.push([
        p.name,
        p.code,
        p.country,
        p.currency || "Unconfirmed",
        p.viaValue ?? "",
        sumKnownMoney(invoices.map((i) => i.amount)) ?? "",
        sumKnownMoney(invoices.map((i) => i.outstanding)) ?? "",
        sumKnownMoney(invoices.map((i) => i.unbilled)) ?? "",
        p.retentionOriginal,
      ]);
    }
    rows.push([
      "Caution",
      "Known totals may be partial. Missing amounts are not zero. Retention is excluded. See reviewed source issues.",
    ]);
    return {
      fileName: `via-internal-${s.asOf}.csv`,
      csv: rows.map((r) => r.map(csvValue).join(",")).join("\r\n"),
    };
  });
