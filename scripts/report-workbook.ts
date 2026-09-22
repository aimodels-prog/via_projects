import ExcelJS from "exceljs";
import { parseCsvRows } from "../src/lib/dashboard-csv";

const sections = [
  [
    "01 Project setup",
    ["project"],
    "PROJECT SETUP — fill once, update only when details change",
    "Used in the dashboard heading, timeline, resources and project parties; applicable details also appear in the PDF.",
    "Enter project details and approved dates. Contact numbers are text. Use the same project URL for monthly updates. Upload the project layout image in the app; it is shared by the PDF and dashboard.",
    ["Project detail", "Enter value", "Not used", "Not used", "What to enter"],
  ],
  [
    "02 Monthly update",
    ["monthly"],
    "MONTHLY REPORT — update for each reporting period",
    "Feeds the five dashboard summary cards, reporting date, timeline and PDF progress tables.",
    "Enter cumulative progress separately from this month's progress. Use 47.95 for 47.95%. Paid amount is money actually paid, not anticipated payment.",
    ["Monthly figure", "Enter value", "Not used", "Not used", "What to enter"],
  ],
  [
    "03 Contract values",
    ["contract"],
    "CONTRACT BREAKDOWN — approved contract amounts",
    "Fills the PDF contract-value table. The dashboard's contract total is selected separately in Project setup.",
    "Enter each approved total, not the amount to add to another row. Use Nil or NA only when confirmed; leave unknown values blank.",
    ["Contract item", "Amount / Nil / NA", "Not used", "Not used", "What to enter"],
  ],
  [
    "04 Activities",
    ["activity"],
    "MAJOR ACTIVITIES — planned versus actual work",
    "Creates the dashboard activity bars and PDF physical-progress table. Differences are calculated automatically.",
    "One activity per row. Enter cumulative percentages for the reporting date. Leave unused rows blank; maximum 13 for the PDF.",
    ["Activity name", "Leave blank", "Planned %", "Actual %", "What to enter"],
  ],
  [
    "05 S-curve schedule",
    ["schedule"],
    "S-CURVE — complete monthly programme",
    "Generates the interactive dashboard graph and the PDF graph automatically. Cumulative totals are calculated from these monthly figures.",
    "Start at the first programme month and include every month to completion. Enter each month's increment, NOT cumulative totals. Leave future actuals blank; use 0 for a verified month with no progress.",
    [
      "Month (e.g. Jul-26)",
      "Leave blank",
      "Monthly planned %",
      "Monthly actual %",
      "What to enter",
    ],
  ],
  [
    "06 Scope quantities",
    ["scope"],
    "PROJECT SCOPE — what is being built",
    "Fills the dashboard Scope & build-up quantities. These are quantities, not progress percentages.",
    "Up to five items. Enter a description, quantity and unit: for example Bridge length | 540 | m. Only include items relevant to this project.",
    ["Scope description", "Quantity", "Unit (km / m / no.)", "Leave blank", "What to enter"],
  ],
  [
    "07 Pavement layers",
    ["layer"],
    "PAVEMENT LAYERS — road construction build-up",
    "Fills the dashboard pavement stack. Layer thickness is measured in millimetres.",
    "List layers from top surface downwards. Example: BWC | Wearing course | 50. Leave unused rows blank.",
    ["Layer code", "Layer description", "Thickness (mm)", "Leave blank", "What to enter"],
  ],
  [
    "08 Trade statuses",
    ["trade"],
    "TRADE STATUS — current state of each work category",
    "Controls the coloured status dots in the dashboard. This does not set route-section colours or create the PDF activity-status drawing.",
    "Use complete, active, behind, notstarted or unknown. Use a short trade name, not a long progress narrative. Up to 12 trades.",
    ["Trade name", "Status", "Leave blank", "Leave blank", "What to enter"],
  ],
  [
    "09 Photo captions",
    ["photo"],
    "CONSTRUCTION PHOTOS — captions only",
    "Captions appear below the four photographs in the PDF and dashboard. Upload the image files in the app.",
    "Photo 1: top-left; 2: top-right; 3: bottom-left; 4: bottom-right. Keep the photo IDs unchanged. Logos are uploaded separately.",
    ["Photo position ID", "Caption", "Not used", "Not used", "What to enter"],
  ],
  [
    "10 Project layout",
    ["layout", "layout_section"],
    "PROJECT LAYOUT — saved drawing and section updates",
    "Selects the saved project geometry and updates its road-section colours. The same drawing can be used in the dashboard and PDF.",
    "First save and approve a drawing in the app and download its linked template. Copy its layout ID and all section IDs here. Statuses: complete, construction, existing, unknown. The fixed raysut-reference illustration is for the demo only and cannot receive section updates.",
    [
      "template / section ID",
      "Layout ID / section status",
      "Leave blank",
      "Leave blank",
      "What to enter",
    ],
  ],
] as const;

function group(section: string, label: string) {
  if (section === "project") {
    if (/Client engineer|Contractor|Consultant/.test(label))
      return "PROJECT PARTIES — organisations and contact people";
    if (/manpower|machinery/i.test(label))
      return "PLANNED RESOURCES — approved people and equipment targets";
    if (/date|days|contract|Currency/i.test(label))
      return "CONTRACT & TIMELINE — approved amount, dates and durations";
    return "PROJECT IDENTITY — name, location, client and description";
  }
  if (section === "monthly") {
    if (/financial|paid/i.test(label)) return "FINANCIAL PROGRESS — percentage and actual payments";
    if (/manpower|machinery/i.test(label))
      return "ACTUAL RESOURCES — people and equipment this month";
    if (/progress/i.test(label)) return "PHYSICAL PROGRESS — cumulative and this month";
    return "REPORT PERIOD & TIME — report reference, date and elapsed days";
  }
  return "";
}
export async function writeReportWorkbook(csv: string, path: string, demo = false) {
  const rows = parseCsvRows(csv);
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Project report");
  ws.addRow(rows[0]!);
  ws.getRow(1).hidden = true;
  for (const text of [
    "PROJECT REPORT — complete the sections below",
    demo
      ? "DUMMY DEMO DATA — not for reporting. Blue cells are inputs; grey cells are labels or unused."
      : "Fill blue cells from top to bottom. Upload this Excel file directly. Leave unknown figures blank, not zero.",
  ]) {
    const row = ws.addRow(["__section__", text]);
    ws.mergeCells(row.number, 2, row.number, 6);
    row.height = 32;
    row.getCell(2).font = { bold: true, size: 13, color: { argb: "FF15354A" } };
  }
  for (const [name, keys, title, purpose, help, labels] of sections) {
    if (!rows.slice(1).some(row => (keys as readonly string[]).includes(row[0]!))) continue;
    const firstRow = ws.rowCount + 1;
    for (const [index, text] of [
      `${name.slice(0, 2)}. ${title}`,
      purpose,
      help,
      demo
        ? "DUMMY DEMO DATA — not for reporting. Blue cells are inputs; grey cells are labels or unused. Blank means unknown, not zero."
        : "Blue cells are inputs; grey cells are labels or unused. Blank means unknown, not zero. Keep the section labels unchanged.",
    ].entries()) {
      const position = firstRow + index;
      ws.getCell(position, 1).value = "__section__";
      ws.mergeCells(position, 2, position, 6);
      ws.getCell(position, 2).value = text;
      ws.getRow(position).height = [32, 36, 62, 36][index]!;
      ws.getCell(position, 2).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: index === 0 ? "FF15354A" : "FFEAF3FF" },
      };
      ws.getCell(position, 2).font = {
        name: "Calibri",
        size: index === 0 ? 15 : 11,
        bold: index === 0,
        color: { argb: index === 0 ? "FFFFFFFF" : "FF15354A" },
      };
    }
    const labelRow = ws.addRow(["__section__", ...labels]);
    labelRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
    labelRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF005A9C" } };
    labelRow.height = 30;
    let lastGroup = "";
    const selected = rows.slice(1).filter((row) => (keys as readonly string[]).includes(row[0]!));
    // Keep related fields together, rather than repeating section headings.
    const groups = [...new Set(selected.map((row) => group(row[0]!, row[1]!)))];
    for (const grouping of groups)
      for (const source of selected.filter((row) => group(row[0]!, row[1]!) === grouping)) {
        if (grouping && grouping !== lastGroup) {
          const row = ws.addRow(["__section__", grouping]);
          ws.mergeCells(row.number, 2, row.number, 6);
          row.height = 26;
          row.getCell(2).font = { bold: true, color: { argb: "FF005A9C" } };
          lastGroup = grouping;
        }
        const row = ws.addRow(source);
        row.height = 46;
        const type = source[0]!;
        const editable =
          type === "activity" || type === "schedule"
            ? [2, 4, 5]
            : type === "scope" || type === "layer"
              ? [2, 3, 4]
              : type === "trade" || type === "layout_section"
                ? [2, 3]
                : [3];
        for (let c = 2; c <= 6; c++)
          row.getCell(c).fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: editable.includes(c) ? "FFEAF3FF" : "FFF2F4F6" },
          };
        if (type === "scope")
          row.getCell(6).value =
            "Describe the item in column B; enter its quantity in C and unit in D. Column E stays blank.";
        if (type === "layer")
          row.getCell(6).value =
            "Enter the code in B, description in C and thickness in millimetres in D. Column E stays blank.";
        if (type === "schedule")
          row.getCell(6).value =
            "Month in B; monthly planned increment in D; monthly actual increment in E. C stays blank. Future actuals remain blank.";
        if (type === "trade")
          row.getCell(6).value =
            "Short trade name in B. Choose its status in C. D and E stay blank.";
        if (type === "activity")
          row.getCell(6).value =
            "Activity name in B; cumulative planned percentage in D and cumulative actual percentage in E. C stays blank. The app calculates actual minus planned.";
        if (type === "layout")
          row.getCell(6).value =
            "Keep template in B. Paste the saved layout ID from the app in C. For the fixed demo illustration only, enter raysut-reference. D and E stay blank.";
        if (type === "layout_section")
          row.getCell(6).value =
            "Paste the saved section ID in B and choose this month's status in C. Include every section from the app's linked template. D and E stay blank. Not used with raysut-reference.";
        if (type === "photo")
          row.getCell(6).value =
            "Keep the photo ID in B and enter its caption in C. Upload the matching photograph separately in the app. Order: photo_1 top-left, photo_2 top-right, photo_3 bottom-left, photo_4 bottom-right.";
        if (type === "trade" || type === "layout_section")
          row.getCell(3).dataValidation = {
            type: "list",
            allowBlank: true,
            formulae: [
              type === "trade"
                ? '"complete,active,behind,notstarted,unknown"'
                : '"complete,construction,existing,unknown"',
            ],
            showErrorMessage: true,
            error: "Choose a status from the list.",
          };
      }
    ws.columns.forEach((col, i) => {
      col.width = [14, 40, 44, 22, 22, 65][i];
    });
    ws.getColumn(1).hidden = true;
    ws.eachRow((row) => {
      row.alignment = { vertical: "top", wrapText: true };
    });
    ws.views = [{ state: "frozen", ySplit: 3, xSplit: 2 }];
    ws.properties.tabColor = { argb: "FF005A9C" };
    ws.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
  }
  await wb.xlsx.writeFile(path);
}
