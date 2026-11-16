export type ImportedRecipient = { name: string; role: string; department: string; project: string; contribution: string; service_period: string };
type Cell = unknown;

function cellText(cell: Cell): string {
  if (cell == null) return "";
  if (cell instanceof Date) return cell.toISOString().slice(0, 10);
  if (["string", "number", "boolean"].includes(typeof cell)) return String(cell).trim();
  throw new Error("Unsupported spreadsheet cell value.");
}

/** RFC-style CSV parsing, including quoted commas, quotes and newlines. */
export function parseCredentialCsv(text: string): string[][] {
  const result: string[][] = []; let row: string[] = []; let cell = ""; let quoted = false; let closed = false;
  const flushCell = () => { row.push(cell); cell = ""; closed = false; };
  const flushRow = () => { flushCell(); if (row.some(value => value.trim())) result.push(row); row = []; };
  text = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') { quoted = false; closed = true; }
      else cell += ch;
    } else if (ch === '"' && !cell && !closed) quoted = true;
    else if (ch === ",") flushCell();
    else if (ch === "\r" || ch === "\n") { if (ch === "\r" && text[i + 1] === "\n") i++; flushRow(); }
    else if (closed || ch === '"') throw new Error("Invalid CSV quoting.");
    else cell += ch;
  }
  if (quoted) throw new Error("CSV contains an unclosed quote.");
  if (row.length || cell) flushRow();
  return result;
}

export function recipientsFromRows(rows: readonly (readonly Cell[])[]): ImportedRecipient[] {
  if (rows.length < 2 || rows.length > 501) throw new Error("Import must have a header and 1–500 recipients.");
  const headings = rows[0].map(value => cellText(value).toLowerCase().replace(/[\s_/-]+/g, ""));
  const aliases: Record<keyof ImportedRecipient, string[]> = {
    name: ["name", "fullname", "recipient", "recipientname"], role: ["role", "position", "roleposition"],
    department: ["department"], project: ["project"], contribution: ["contribution", "contributiondescription"],
    service_period: ["serviceperiod"],
  };
  const indexes = Object.fromEntries(Object.entries(aliases).map(([key, options]) => {
    const found = headings.flatMap((heading, index) => options.includes(heading) ? [index] : []);
    if (found.length > 1) throw new Error(`Multiple columns match ${key}.`);
    return [key, found[0] ?? -1];
  })) as Record<keyof ImportedRecipient, number>;
  if (indexes.name === -1) throw new Error("A Name or Full Name column is required.");
  const result = rows.slice(1).filter(row => row.some(value => cellText(value))).map((row, index) => {
    const value = (key: keyof ImportedRecipient) => cellText(row[indexes[key]]);
    const item: ImportedRecipient = { name: value("name"), role: value("role"), department: value("department"), project: value("project"), contribution: value("contribution"), service_period: value("service_period") };
    if (!item.name || item.name.length > 200 || Object.values(item).some(part => part.length > 4000)) throw new Error(`Invalid recipient in row ${index + 2}.`);
    return item;
  });
  if (!result.length) throw new Error("At least one recipient is required.");
  return result;
}
