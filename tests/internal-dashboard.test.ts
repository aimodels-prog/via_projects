import test from "node:test";
import assert from "node:assert/strict";
import { internalFixture } from "./internal-fixture";
import { parseInternalWorkbook, validAsOf } from "../src/lib/internal-excel.server";
import {
  internalSummary,
  sumMoney,
  sumKnownMoney,
  subtractMoney,
  elapsedPercent,
} from "../src/lib/internal.types";

test("internal workbook normalizes merged projects, teams and separate IPC amendments without double counting", async () => {
  const report = await parseInternalWorkbook(await internalFixture(), "2026-06-30");
  assert.equal(report.projects.length, 2);
  assert.equal(report.staff.length, 2);
  assert.equal(report.invoices.length, 4);
  assert.equal(report.invoices[2]?.number, "IPC No. 02A");
  const totals = internalSummary(report);
  assert.equal(totals.invoiced, "350.000000");
  assert.equal(totals.outstanding, "200.000000");
  assert.equal(totals.received, "150.000000");
  assert.equal(totals.viaValue, "1000.000000");
  assert.equal(totals.omanization, 50);
  assert.equal(totals.activeStaff, 2);
  for (const code of [
    "EXTERNAL_LINK",
    "TOTAL_MISMATCH",
    "RETENTION_UNCONFIRMED",
    "CURRENCY_UNCONFIRMED",
    "PROJECT_MAPPING",
    "FUTURE_INVOICE",
  ])
    assert.ok(
      report.issues.some((i) => i.code === code),
      code,
    );
  assert.equal(report.projects[0]?.retentionClassification, "unconfirmed");
  assert.ok(report.notes.length);
});
test("internal import keeps missing amounts and formula errors unknown", async () => {
  const bytes = await internalFixture((b) => {
    b.getWorksheet("Nakheel")!.getCell("F7").value = null;
    b.getWorksheet("Dashboard")!.getCell("K3").value = {
      formula: "1/0",
      result: { error: "#DIV/0!" },
    };
  });
  const report = await parseInternalWorkbook(bytes, "2026-06-30");
  assert.equal(report.invoices[1]?.outstanding, null);
  assert.equal(internalSummary(report).incompleteInvoices, 1);
  assert.equal(report.staff[0]?.end, null);
  assert.ok(report.issues.some((i) => i.code === "FORMULA_ERROR"));
});
test("internal import rejects duplicate IPCs, mismatched columns and contradictory payments", async () => {
  await assert.rejects(
    () =>
      internalFixture((b) => {
        b.getWorksheet("Nakheel")!.getCell("B8").value = "IPC No. 02";
      }).then((b) => parseInternalWorkbook(b, "2026-06-30")),
    /duplicate IPC/,
  );
  await assert.rejects(
    () =>
      internalFixture((b) => {
        b.getWorksheet("Nakheel")!.getCell("D5").value = "Something else";
      }).then((b) => parseInternalWorkbook(b, "2026-06-30")),
    /headers/,
  );
  await assert.rejects(
    () =>
      internalFixture((b) => {
        b.getWorksheet("Nakheel")!.getCell("F6").value = 2;
      }).then((b) => parseInternalWorkbook(b, "2026-06-30")),
    /Received conflicts/,
  );
  await assert.rejects(
    () =>
      internalFixture((b) => {
        b.getWorksheet("Nakheel")!.getCell("F7").value = 201;
      }).then((b) => parseInternalWorkbook(b, "2026-06-30")),
    /exceeds/,
  );
});
test("internal workbook does not silently skip new invoice sheets", async () => {
  const bytes = await internalFixture((b) => {
    const s = b.addWorksheet("Unmapped Project");
    s.getCell("B6").value = "IPC No. 01";
  });
  await assert.rejects(() => parseInternalWorkbook(bytes, "2026-06-30"), /Cannot uniquely match/);
});
test("internal date validation and bounded ZIP parsing fail closed", async () => {
  assert.equal(validAsOf("2026-02-30"), false);
  assert.equal(validAsOf("2024-02-29"), true);
  await assert.rejects(
    () => parseInternalWorkbook(Buffer.from("not Excel"), "2026-06-30"),
    /valid .xlsx/,
  );
  await assert.rejects(
    () => parseInternalWorkbook(Buffer.alloc(11 * 1024 * 1024), "2026-06-30"),
    /10 MB/,
  );
  assert.equal(elapsedPercent("2026-01-01", "2027-01-01", "2025-01-01"), 0);
  assert.equal(elapsedPercent("2026-01-01", "2026-01-01", "2026-06-30"), null);
});
test("financial additions use decimal arithmetic, not binary floating point", () => {
  assert.equal(sumMoney(["0.100000", "0.200000"]), "0.300000");
  assert.equal(subtractMoney("0.300000", "0.100000"), "0.200000");
});
test("unknown financial aggregates stay unknown, not zero", async () => {
  assert.equal(sumKnownMoney([]), null);
  assert.equal(sumKnownMoney([null, null]), null);
  assert.equal(sumKnownMoney([null, "0.000000"]), "0.000000");
  const report = await parseInternalWorkbook(await internalFixture(), "2026-06-30");
  report.invoices.forEach((i) => {
    i.amount = null;
    i.outstanding = null;
    i.unbilled = null;
  });
  const summary = internalSummary(report);
  assert.equal(summary.invoiced, null);
  assert.equal(summary.outstanding, null);
  assert.equal(summary.received, null);
  assert.equal(summary.unbilled, null);
  assert.equal(summary.series[0].invoiced, null);
});
