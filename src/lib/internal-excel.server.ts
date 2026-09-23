import ExcelJS from "exceljs";
import { createHash } from "node:crypto";
import type { InternalReport, InternalProject, InternalInvoice, Source } from "./internal.types";
import { moneyFromNumber, subtractMoney, sumMoney } from "./internal.types";
import { checkInternalXlsx } from "./internal-xlsx-safety";

const invoiceMappings: Record<string, string> = {
  Nakheel: "Nakheel",
  "Seih Al Qatnah": "Jebel Akhdar",
  Lima: "Lima Dam",
  "Sohar 5 Bridge": "5 Bridges",
  "Raysut Mughsayl Road": "Salalah ROAD",
  "Mughsayl Bridge": "Salalah BRIDGE",
  "Al Hazim Nama": "Al Hazim",
};
export function validAsOf(value: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value
  );
}
export async function parseInternalWorkbook(
  bytes: Uint8Array,
  asOf: string,
): Promise<InternalReport> {
  if (!validAsOf(asOf)) throw new Error("Choose a valid reporting date.");
  if (!bytes.length || bytes.length > 10 * 1024 * 1024)
    throw new Error("Upload an Excel workbook no larger than 10 MB.");
  checkInternalXlsx(bytes);
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(Buffer.from(bytes) as unknown as ExcelJS.Buffer);
  if (
    book.worksheets.length > 40 ||
    book.worksheets.some((s) => s.rowCount > 5000 || s.columnCount > 150)
  )
    throw new Error("Workbook is too large. Use the supervision summary template.");
  const dashboard = book.getWorksheet("Dashboard");
  if (
    !dashboard ||
    dashboard.getCell("A1").text.trim() !== "Project" ||
    dashboard.getCell("E2").text.trim() !== "Position"
  )
    throw new Error(
      "Expected the supervision workbook: Dashboard sheet with Project and Team/Position headers.",
    );
  const report: InternalReport = {
    version: 1,
    asOf,
    projects: [],
    staff: [],
    invoices: [],
    targets: [],
    notes: [],
    issues: [],
  };
  const seenIssues = new Set<string>();
  const source = (cell: ExcelJS.Cell): Source => ({
    sheet: cell.worksheet.name,
    cell: cell.master.address,
  });
  function issue(cell: ExcelJS.Cell, code: string, message: string) {
    const s = source(cell),
      key = `${s.sheet}:${s.cell}:${code}`;
    if (!seenIssues.has(key)) {
      report.issues.push({ ...s, code, message });
      seenIssues.add(key);
    }
  }
  function raw(cell: ExcelJS.Cell): unknown {
    const v = cell.value;
    if (v && typeof v === "object" && !(v instanceof Date)) {
      if ("richText" in v) return v.richText.map((x) => x.text).join("");
      if ("text" in v) return v.text;
      if ("error" in v) {
        issue(cell, "FORMULA_ERROR", `Excel error ${v.error}; not used as a value.`);
        return null;
      }
      if ("formula" in v || "sharedFormula" in v) {
        const formula = cell.formula || "";
        if (/\[[^\]]+\]/.test(formula))
          issue(
            cell,
            "EXTERNAL_LINK",
            "External workbook link. Its saved result is unverified; no external file was opened.",
          );
        const result = cell.result;
        if (result && typeof result === "object" && "error" in result) {
          issue(cell, "FORMULA_ERROR", `Excel error ${result.error}; not used as a value.`);
          return null;
        }
        if (result === undefined || result === null) {
          issue(cell, "MISSING_RESULT", "Formula has no saved result. Treat as unknown, not zero.");
          return null;
        }
        return result;
      }
    }
    return v;
  }
  function text(cell: ExcelJS.Cell) {
    const v = raw(cell);
    return v === null || v === undefined ? "" : String(v).trim().slice(0, 2000);
  }
  function number(cell: ExcelJS.Cell) {
    const v = raw(cell);
    if (v === null || v === undefined || v === "" || v === "-") return null;
    if (typeof v !== "number" || !Number.isFinite(v)) {
      issue(cell, "INVALID_NUMBER", "Expected a number; original text needs review.");
      return null;
    }
    return v;
  }
  function money(cell: ExcelJS.Cell) {
    const n = number(cell);
    if (n === null) return null;
    if (n < 0 || n > 1_000_000_000) {
      issue(
        cell,
        "INVALID_AMOUNT",
        "Negative or out-of-range amount requires review; excluded from totals.",
      );
      return null;
    }
    return moneyFromNumber(n);
  }
  function date(cell: ExcelJS.Cell) {
    const v = raw(cell);
    if (v === null || v === undefined || v === "") return null;
    if (v instanceof Date && Number.isFinite(v.getTime())) return v.toISOString().slice(0, 10);
    if (typeof v === "string" && validAsOf(v)) return v;
    issue(cell, "INVALID_DATE", "Date must be an Excel date or YYYY-MM-DD; not guessed from text.");
    return null;
  }
  function percentage(cell: ExcelJS.Cell) {
    const n = number(cell);
    if (n === null) return null;
    if (n < 0 || n > 1) {
      issue(cell, "INVALID_PERCENT", "Expected an Excel percentage between 0% and 100%.");
      return null;
    }
    return n * 100;
  }
  const idFor = (country: string, name: string) =>
    createHash("sha256")
      .update(`${country}:${name.toLowerCase().replace(/\s+/g, " ")}`)
      .digest("hex")
      .slice(0, 24);
  let project: InternalProject | undefined;
  dashboard.eachRow((row, n) => {
    if (n < 3) return;
    const a = row.getCell("A");
    if ((!a.isMerged || a.master.address === a.address) && text(a)) {
      const name = text(a),
        code = name.match(/W\.\d{4}\.[A-Za-z0-9.]+/)?.[0] || "";
      project = {
        id: idFor("Oman", code || name),
        name,
        code,
        country: "Oman",
        currency: "OMR",
        start: date(row.getCell("B")),
        end: date(row.getCell("D")),
        eot: text(row.getCell("C")),
        client: text(row.getCell("P")),
        clientPm: text(row.getCell("Q")),
        contractor: text(row.getCell("R")),
        contractorPm: text(row.getCell("S")),
        partner: "",
        contractorValue: money(row.getCell("T")),
        viaValue: money(row.getCell("U")),
        physical: percentage(row.getCell("V")),
        reportedInvoiced: money(row.getCell("Y")),
        reportedOutstanding: money(row.getCell("Z")),
        retentionOriginal: text(row.getCell("AA")),
        retentionClassification: "unconfirmed",
        source: source(a),
      };
      report.projects.push(project);
      if (project.retentionOriginal && project.retentionOriginal !== "-")
        issue(
          row.getCell("AA"),
          "RETENTION_UNCONFIRMED",
          "Retention ownership and basis are unconfirmed. Preserved as text and excluded from VIA receivables.",
        );
    }
    if (!project) return;
    const position = text(row.getCell("E")),
      name = text(row.getCell("F"));
    if (!position && !name) return;
    const start = date(row.getCell("J")),
      end = date(row.getCell("K"));
    if (!start || !end)
      issue(
        row.getCell("J"),
        "STAFF_DATES",
        "Incomplete staff contract dates; excluded from dated active-headcount calculations.",
      );
    if (start && end && end < start)
      issue(row.getCell("K"), "DATE_ORDER", "Staff contract end is before its start.");
    const cars = number(row.getCell("O"));
    if (cars !== null && (!Number.isInteger(cars) || cars < 0))
      issue(row.getCell("O"), "CARS", "Vehicle count must be a non-negative whole number.");
    report.staff.push({
      projectId: project.id,
      position,
      name,
      nationalityGroup: text(row.getCell("G")),
      gender: text(row.getCell("I")),
      start,
      end,
      accommodation: text(row.getCell("N")),
      cars: cars !== null && Number.isInteger(cars) && cars >= 0 ? cars : null,
      source: source(row.getCell("E")),
    });
    // Inspect errors in stored duration/elapsed cells, but never use TODAY() caches.
    raw(row.getCell("L"));
    raw(row.getCell("M"));
  });
  const africa = book.getWorksheet("AFRICA");
  africa?.eachRow((row, n) => {
    if (n < 2 || !text(row.getCell("A"))) return;
    const name = text(row.getCell("A")),
      country = text(row.getCell("B"));
    report.projects.push({
      id: idFor(country, name),
      name,
      code: "",
      country,
      currency: null,
      start: date(row.getCell("C")),
      end: date(row.getCell("E")),
      eot: text(row.getCell("D")),
      client: "",
      clientPm: "",
      contractor: "",
      contractorPm: "",
      partner: text(row.getCell("F")),
      contractorValue: null,
      viaValue: money(row.getCell("G")),
      physical: null,
      reportedInvoiced: money(row.getCell("I")),
      reportedOutstanding: money(row.getCell("K")),
      retentionOriginal: "",
      retentionClassification: "unconfirmed",
      source: source(row.getCell("A")),
    });
    issue(
      row.getCell("G"),
      "CURRENCY_UNCONFIRMED",
      "International currency and billing references need confirmation. Excluded from OMR company financial totals.",
    );
  });
  if (!report.projects.length) throw new Error("No project records were found in Dashboard.");
  if (new Set(report.projects.map((p) => p.id)).size !== report.projects.length)
    throw new Error(
      "Duplicate project identifiers found. Resolve duplicate project codes before importing.",
    );
  const invoiceSheets = book.worksheets.filter((sheet) => {
    if (Object.hasOwn(invoiceMappings, sheet.name)) return true;
    if (["Dashboard", "AFRICA", "Summary", "Summary Monthly"].includes(sheet.name)) return false;
    let found = false;
    sheet.eachRow((row) => {
      if (/^IPC\b/i.test(row.getCell("B").text.trim())) found = true;
    });
    return found;
  });
  const normalize = (s: string) =>
    s
      .replace(/W\.\d{4}\.[A-Za-z0-9.]+/g, "")
      .replace(/[^a-z0-9]/gi, "")
      .toLowerCase();
  for (const sheet of invoiceSheets) {
    const sheetName = sheet.name,
      prefix = invoiceMappings[sheetName];
    const matches = report.projects.filter(
      (p) =>
        p.country === "Oman" &&
        (prefix
          ? p.name.toLowerCase().startsWith(prefix.toLowerCase())
          : normalize(p.name) === normalize(sheetName) ||
            p.code.toLowerCase() === sheetName.toLowerCase()),
    );
    if (matches.length !== 1)
      throw new Error(
        `Cannot uniquely match invoice sheet ${sheetName} to Dashboard. Correct its project name first.`,
      );
    const p = matches[0]!;
    sheet.eachRow((row) =>
      row.eachCell((cell) => {
        if (Number(cell.col) <= 7 || (cell.isMerged && cell.master.address !== cell.address))
          return;
        const v = raw(cell);
        if (v !== null && v !== undefined && v !== "")
          report.notes.push({
            projectId: p.id,
            text: v instanceof Date ? v.toISOString().slice(0, 10) : String(v),
            source: source(cell),
          });
      }),
    );
    if (report.notes.some((n) => n.projectId === p.id))
      issue(
        sheet.getCell("H5"),
        "SUPPLEMENTAL_NOTES",
        "Additional source notes were preserved separately. Review them for unbilled-work context; they are not automatically turned into financial amounts.",
      );
    if (
      !sheet.getCell("D5").text.toLowerCase().includes("invoice") ||
      !sheet.getCell("F5").text.toLowerCase().includes("balance")
    )
      throw new Error(
        `${sheetName}: invoice headers have changed. Import stopped to avoid column misalignment.`,
      );
    issue(
      sheet.getCell("B5"),
      "PROJECT_MAPPING",
      `Review mapping: ${sheetName} → ${p.name}. Invoice detail rows will be the billing source; Dashboard totals are comparison values only.`,
    );
    const keys = new Set<string>();
    sheet.eachRow((row, n) => {
      if (n < 6) return;
      const label = text(row.getCell("B"));
      if (!/^IPC\b/i.test(label)) return;
      if (keys.has(label.toLowerCase()))
        throw new Error(`${sheetName}!B${n}: duplicate IPC number ${label}.`);
      keys.add(label.toLowerCase());
      const dateValue = date(row.getCell("C")),
        period = dateValue?.slice(0, 7) || null;
      if (!period)
        issue(
          row.getCell("C"),
          "INVOICE_PERIOD",
          "Missing invoice period: excluded from all dated financial totals.",
        );
      if (period && period > asOf.slice(0, 7))
        issue(
          row.getCell("C"),
          "FUTURE_INVOICE",
          "Invoice period is after the reporting date; excluded from snapshot totals.",
        );
      const amount = money(row.getCell("D")),
        statusText = text(row.getCell("E")).toLowerCase();
      const status: InternalInvoice["status"] =
        statusText === "received"
          ? "received"
          : statusText === "not received"
            ? "unpaid"
            : "unknown";
      let outstanding = money(row.getCell("F"));
      if (outstanding === null && status === "received" && row.getCell("F").value === null)
        outstanding = moneyFromNumber(0);
      // Evaluate only the template's direct amount-reference formula, not arbitrary Excel formulas.
      if (
        row
          .getCell("F")
          .formula?.replace(/^\+|\$/g, "")
          .toUpperCase() === `D${n}`
      )
        outstanding = amount;
      const unbilled = money(row.getCell("G"));
      if (status === "unknown")
        issue(
          row.getCell("E"),
          "PAYMENT_STATUS",
          "Payment status is missing or unsupported; do not infer collection from a blank cell.",
        );
      if (amount === null || outstanding === null || unbilled === null)
        issue(
          row.getCell("D"),
          "INCOMPLETE_INVOICE",
          "Incomplete amounts. Unknown fields are excluded; dashboard totals will be marked partial.",
        );
      if (outstanding !== null && amount !== null && Number(outstanding) > Number(amount))
        throw new Error(
          `${sheetName}!F${n}: outstanding exceeds invoice amount. Correct the workbook before approval.`,
        );
      if (status === "received" && outstanding !== null && Number(outstanding) > 0)
        throw new Error(
          `${sheetName}!E${n}: Received conflicts with a positive outstanding balance.`,
        );
      report.invoices.push({
        projectId: p.id,
        number: label,
        period,
        amount,
        outstanding,
        unbilled,
        status,
        source: source(row.getCell("B")),
      });
    });
    const rows = report.invoices.filter((i) => i.projectId === p.id);
    for (const [field, reported, col] of [
      ["amount", p.reportedInvoiced, "Y"],
      ["outstanding", p.reportedOutstanding, "Z"],
    ] as const) {
      if (reported !== null && rows.length && rows.every((i) => i[field] !== null)) {
        const computed = sumMoney(rows.map((i) => i[field]));
        if (Math.abs(Number(subtractMoney(computed, reported))) > 0.002)
          report.issues.push({
            ...p.source,
            cell: `${col}${p.source.cell.slice(1)}`,
            code: "TOTAL_MISMATCH",
            message: `${p.name}: Dashboard ${reported} differs from invoice rows ${computed} OMR (${field}). Approval adopts invoice rows, not the cached Dashboard figure.`,
          });
      }
    }
  }
  for (const sheet of book.worksheets) {
    if (
      ![
        "Dashboard",
        "AFRICA",
        "Summary",
        "Summary Monthly",
        ...Object.keys(invoiceMappings),
      ].includes(sheet.name)
    ) {
      let ipc = false;
      sheet.eachRow((row) => {
        if (/^IPC\b/i.test(row.getCell("B").text.trim())) ipc = true;
      });
      if (ipc && !invoiceSheets.includes(sheet))
        throw new Error(
          `Unmapped invoice sheet ${sheet.name}. Add its project mapping before importing; no invoice sheet may be silently skipped.`,
        );
    }
  }
  const monthly = book.getWorksheet("Summary Monthly");
  monthly?.eachRow((row, n) => {
    if (n < 8) return;
    const name = text(row.getCell("C"));
    if (typeof row.getCell("D").value !== "number" || !name) return;
    const prefixes = /Mughsayl Road\s*\+\s*Bridge/i.test(name)
      ? ["Salalah ROAD", "Salalah BRIDGE"]
      : [
          invoiceMappings[name] ||
            (name === "Lima Dam" ? "Lima Dam" : name === "Nama Al Hazim" ? "Al Hazim" : name),
        ];
    const matched = report.projects.filter(
      (p) =>
        p.country === "Oman" &&
        prefixes.some((prefix) => p.name.toLowerCase().startsWith(prefix.toLowerCase())),
    );
    if (!matched.length) {
      issue(
        row.getCell("C"),
        "TARGET_MAPPING",
        "Monthly target could not be mapped to a project; not included in target comparison.",
      );
      return;
    }
    report.targets.push({
      name,
      projectIds: matched.map((p) => p.id),
      monthly: money(row.getCell("D")),
      contract: money(row.getCell("E")),
      source: source(row.getCell("C")),
    });
    issue(
      row.getCell("D"),
      "TARGET_BASIS",
      "Monthly contract input retained for review, not treated as an unpaid invoice or earned revenue. Partial months, tax basis and grouped contracts need confirmation.",
    );
  });
  for (const p of report.projects.filter(
    (p) => p.currency === "OMR" && !report.invoices.some((i) => i.projectId === p.id),
  ))
    report.issues.push({
      ...p.source,
      code: "NO_LEDGER",
      message: `${p.name}: no invoice ledger supplied. Not included in invoice totals; this does not mean zero invoicing.`,
    });
  return report;
}
