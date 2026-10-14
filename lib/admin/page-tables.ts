export type TableCell = string | number | boolean | null | undefined;
export type TableRow = Readonly<Record<string, TableCell>>;
export type PageTable = {
  id: string;
  title: string;
  description: string;
  filename: string;
  columns: readonly { key: string; label: string }[];
  rows: readonly TableRow[];
};

export function cellText(value: TableCell): string {
  return value == null
    ? ""
    : typeof value === "boolean"
      ? value
        ? "Yes"
        : "No"
      : String(value);
}

export function filterTableRows(
  table: PageTable,
  query: string,
): readonly TableRow[] {
  const needle = query.trim().toLocaleLowerCase();
  return needle
    ? table.rows.filter((row) =>
        table.columns.some((column) =>
          cellText(row[column.key]).toLocaleLowerCase().includes(needle),
        ),
      )
    : table.rows;
}

/** Quote every cell, preserve Unicode, and neutralize spreadsheet formula injection. */
export function tableCsv(table: PageTable): string {
  const escape = (value: TableCell) => {
    const text = cellText(value);
    const safe =
      /^[\s\uFEFF]*[=+\-@]/u.test(text) || /^[\t\r\n]/u.test(text)
        ? `'${text}`
        : text;
    return `"${safe.replaceAll('"', '""')}"`;
  };
  return (
    "\uFEFF" +
    [
      table.columns.map((column) => escape(column.label)).join(","),
      ...table.rows.map((row) =>
        table.columns.map((column) => escape(row[column.key])).join(","),
      ),
    ].join("\r\n") +
    "\r\n"
  );
}

export function downloadTableCsv(table: PageTable) {
  const url = URL.createObjectURL(
    new Blob([tableCsv(table)], { type: "text/csv;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = table.filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Keep the blob alive long enough for Safari to start the download.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
