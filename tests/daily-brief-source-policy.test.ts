import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260831000000_remove_gov_uk_daily_brief_sources.sql"),
  "utf8",
);

describe("Daily Brief source policy", () => {
  it("removes and prevents gov.uk candidate feeds without erasing historical items", () => {
    expect(migration).toContain("delete from public.daily_brief_sources");
    expect(migration).toContain("daily_brief_sources_not_gov_uk_check");
    expect(migration).toContain("gov\\\\.uk");
    expect(migration).toContain("ON DELETE SET NULL");
  });
});
