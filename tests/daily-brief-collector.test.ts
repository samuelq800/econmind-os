import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const collector = readFileSync(resolve(process.cwd(), "supabase/functions/collect-daily-economic-brief/index.ts"), "utf8");
const migration = readFileSync(resolve(process.cwd(), "supabase/migrations/20260824010000_repair_daily_brief_freshness.sql"), "utf8");

describe("Daily Brief collector safety contract", () => {
  it("removes database duplicates before applying the daily selection limit", () => {
    const duplicateLookup = collector.indexOf("findExistingFingerprints(admin");
    const unseenFilter = collector.indexOf("!existingFingerprints.has");
    const selection = collector.indexOf("selectBriefsForReview(unseenCandidates");

    expect(duplicateLookup).toBeGreaterThan(-1);
    expect(unseenFilter).toBeGreaterThan(duplicateLookup);
    expect(selection).toBeGreaterThan(unseenFilter);
  });

  it("records freshness, duplicate, stale, and source-failure diagnostics", () => {
    expect(collector).toContain('cache: "no-store"');
    expect(collector).toContain("freshCandidates");
    expect(collector).toContain("staleSkipped");
    expect(collector).toContain("duplicatesSkipped");
    expect(collector).toContain("sourceFailures");
  });

  it("migrates stored content to short, attributed source excerpts", () => {
    expect(migration).toContain("summary_kind");
    expect(migration).toContain("char_length(summary) > 360");
    expect(migration).toContain("daily_brief_items_source_excerpt_length");
    expect(migration).toContain("published_source_at set not null");
    expect(migration).toContain("minimum_score between 55 and 100");
    expect(migration).toContain("publication_mode = 'review'");
    expect(migration).toContain("'WTO News'");
  });
});
