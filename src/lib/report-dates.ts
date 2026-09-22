const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
export function monthKey(value: string): string | null {
  const iso = /^(\d{4})-(\d{2})$/.exec(value.trim());
  if (iso && Number(iso[2]) >= 1 && Number(iso[2]) <= 12) return value.trim();
  const match = /^([a-z]+)[\s-]+(\d{2}|\d{4})$/i.exec(value.trim());
  if (!match) return null;
  const month = months.indexOf(match[1]!.slice(0, 3).toLowerCase());
  if (month < 0) return null;
  const year = match[2]!.length === 2 ? `20${match[2]}` : match[2]!;
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}
export function reportDate(value: string): number | null {
  const cleaned = value.trim().replace(/(\d)(st|nd|rd|th)\b/gi, "$1");
  let year: number, month: number, day: number;
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(cleaned);
  const dmy = /^(\d{1,2})[- /]([a-z]+|\d{1,2})[- /](\d{2}|\d{4})$/i.exec(cleaned);
  if (iso) {
    year = Number(iso[1]);
    month = Number(iso[2]);
    day = Number(iso[3]);
  } else if (dmy) {
    day = Number(dmy[1]);
    month = /^\d+$/.test(dmy[2]!)
      ? Number(dmy[2])
      : months.indexOf(dmy[2]!.slice(0, 3).toLowerCase()) + 1;
    year = Number(dmy[3]) + (dmy[3]!.length === 2 ? 2000 : 0);
  } else return null;
  const time = Date.UTC(year, month - 1, day),
    date = new Date(time);
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
    ? time
    : null;
}
