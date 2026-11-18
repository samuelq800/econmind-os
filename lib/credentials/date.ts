const MONTHS = ["january","february","march","april","may","june","july","august","september","october","november","december"];

/** Accept the printed English date or ISO date without normalizing invalid days. */
export function parseCertificateDate(value: string): string | null {
  const text = value.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  const printed = /^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/.exec(text);
  let year: number, month: number, day: number;
  if (iso) { year = Number(iso[1]); month = Number(iso[2]); day = Number(iso[3]); }
  else if (printed) {
    year = Number(printed[3]); day = Number(printed[1]);
    const token = printed[2].toLowerCase();
    month = MONTHS.findIndex(name => name === token || (token.length === 3 && name.startsWith(token))) + 1;
  } else return null;
  if (year < 2000 || year > 9999 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return `${String(year).padStart(4,"0")}-${String(month).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
}
