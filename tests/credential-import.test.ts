import { describe, expect, it } from "vitest";
import { parseCredentialCsv, recipientsFromRows } from "@/lib/credentials/import";
import { readSheet } from "read-excel-file/node";

describe("credential recipient import", () => {
  it("preserves per-person roles, projects, and quoted multiline contributions", () => {
    const csv = '\ufeffFull Name,Position,Department,Project,Contribution Description,Service Period\r\n"A, B",Developer,Technology,Website,"First line\nSecond ""quoted"" line",2026\r\nC,Editor,Communications,Media,Edited work,2025-2026';
    const entries = recipientsFromRows(parseCredentialCsv(csv));
    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({ name: "A, B", role: "Developer", contribution: 'First line\nSecond "quoted" line', service_period: "2026" });
    expect(entries[1]).toMatchObject({ name: "C", role: "Editor", department: "Communications" });
  });
  it("rejects malformed CSV and ambiguous or missing name columns", () => {
    expect(() => parseCredentialCsv('Name\n"Unfinished')).toThrow("unclosed");
    expect(() => recipientsFromRows([["Role"], ["Developer"]])).toThrow("Name");
    expect(() => recipientsFromRows([["Name", "Full Name"], ["A", "B"]])).toThrow("Multiple");
  });
  it("imports an actual XLSX workbook with per-person fields", async () => {
    const rows = await readSheet("tests/fixtures/credential-import.xlsx");
    expect(recipientsFromRows(rows)).toMatchObject([{ name: "Test Person", role: "Developer", department: "Technology", contribution: "Built a test component" }]);
  });
});
