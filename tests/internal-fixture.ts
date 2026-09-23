import ExcelJS from "exceljs";
export async function internalFixture(change?: (book: ExcelJS.Workbook) => void) {
  const book = new ExcelJS.Workbook();
  const s = book.addWorksheet("Dashboard");
  s.getCell("A1").value = "Project";
  s.getCell("E2").value = "Position";
  for (const col of ["A", "B", "C", "D", "P", "Q", "R", "S", "T", "U", "V", "Y", "Z", "AA"])
    s.mergeCells(`${col}3:${col}4`);
  s.getCell("A3").value = "Nakheel W.2024.OM.03";
  s.getCell("B3").value = new Date("2026-01-01");
  s.getCell("D3").value = new Date("2026-12-31");
  s.getCell("C3").value = "pending";
  s.getCell("T3").value = 10000;
  s.getCell("U3").value = 1000;
  s.getCell("V3").value = 0.4;
  s.getCell("Y3").value = { formula: "'[1]Nakheel'!D23", result: 300 };
  s.getCell("Z3").value = 200;
  s.getCell("AA3").value = "10% of certified value";
  for (const n of [3, 4]) {
    s.getCell(`E${n}`).value = "Engineer";
    s.getCell(`F${n}`).value = `Test person ${n}`;
    s.getCell(`G${n}`).value = n === 3 ? "Omani" : "Expat";
    s.getCell(`J${n}`).value = new Date("2026-01-01");
    s.getCell(`K${n}`).value = new Date("2026-12-31");
    s.getCell(`N${n}`).value = "Yes";
    s.getCell(`O${n}`).value = 1;
  }
  const a = book.addWorksheet("AFRICA");
  a.getCell("A1").value = "Project";
  a.getCell("A2").value = "Test international project";
  a.getCell("B2").value = "Uganda";
  a.getCell("G2").value = 9000;
  const ledger = book.addWorksheet("Nakheel");
  ledger.getRow(5).values = [
    undefined,
    "No.",
    "Period",
    "Invoice Amt",
    "Payment Status",
    "Balance to be received",
    "Balance to be invoiced",
  ];
  for (const [n, label, period, amount, status, balance] of [
    [6, "01", "2026-05-01", 100, "Received", 0],
    [7, "02", "2026-06-01", 200, "Not Received", 200],
    [8, "02A", "2026-06-01", 50, "Received", 0],
    [9, "03", "2026-07-01", 500, "Not Received", 500],
  ] as const) {
    ledger.getCell(`B${n}`).value = `IPC No. ${label}`;
    ledger.getCell(`C${n}`).value = new Date(period);
    ledger.getCell(`D${n}`).value = amount;
    ledger.getCell(`E${n}`).value = status;
    ledger.getCell(`F${n}`).value = balance;
    ledger.getCell(`G${n}`).value = 0;
  }
  ledger.getCell("K5").value = "Unbilled work note";
  ledger.getCell("K6").value = "Verify engineer mobilisation";
  const monthly = book.addWorksheet("Summary Monthly");
  monthly.getCell("C8").value = "Nakheel";
  monthly.getCell("D8").value = 100;
  monthly.getCell("E8").value = 1000;
  change?.(book);
  return Buffer.from(await book.xlsx.writeBuffer());
}
