import { parseCsvRows } from "./dashboard-csv";

export function reviewCsvRows(text: string): string[][] | null {
  const rows = parseCsvRows(text);
  if (rows[0]?.join(",").toLowerCase() !== "section,field,value,planned,actual,instructions")
    return null;
  if (rows.some((row) => row.length !== 6)) return null;
  return rows;
}
export function serializeReviewRows(rows: string[][]) {
  return rows
    .map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(","))
    .join("\r\n");
}
export function missingReviewCells(row: string[]): number[] {
  const [section, field, value, planned, actual] = row;
  if (
    ["activity", "scope", "layer", "schedule", "trade"].includes(section!) &&
    !field &&
    !value &&
    !planned &&
    !actual
  )
    return [];
  const required =
    section === "activity"
      ? [1, 3, 4]
      : section === "scope" || section === "layer"
        ? [1, 2, 3]
        : section === "schedule"
          ? [1, 3]
          : ["project", "monthly", "contract", "trade", "photo"].includes(section!)
            ? [2]
            : [];
  return required.filter((index) => !row[index]?.trim());
}
