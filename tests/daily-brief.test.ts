import { describe, expect, it } from "vitest";
import { linkCases, normaliseText, scoreCandidate, slugForBrief, stableFingerprint } from "@/lib/daily-brief/rules";

describe("Daily Brief deterministic rules", () => {
  const candidate = { sourceId: "source-1", sourceName: "Official source", sourceUrl: "https://example.org/feed.xml", canonicalUrl: "https://example.org/article?utm=ignored", title: "Carbon tax reform and emissions trading", summary: "A public policy update explains carbon pricing, emissions reductions, and the distribution of revenue across households.", publishedSourceAt: "2026-07-28T00:00:00.000Z" };

  it("normalises text and produces a stable duplicate fingerprint", () => {
    expect(normaliseText(" <b>Carbon</b> &amp; trade! ")).toBe("carbon trade");
    expect(stableFingerprint(candidate.title, candidate.canonicalUrl)).toBe(stableFingerprint(candidate.title, "https://example.org/article?other=1"));
  });

  it("links relevant content to the carbon tax case", () => {
    expect(linkCases(candidate.title, candidate.summary).caseSlugs).toContain("carbon-tax");
  });

  it("scores candidates with an explicit breakdown and stable slug", () => {
    const scored = scoreCandidate(candidate);
    expect(scored.score).toBeGreaterThanOrEqual(55);
    expect(scored.breakdown.topical).toBeGreaterThan(0);
    expect(slugForBrief(scored)).toMatch(/^2026-07-28-/);
  });

  it("does not pretend generic short content has strong teaching relevance", () => {
    const scored = scoreCandidate({ ...candidate, title: "Update", summary: "Brief note.", canonicalUrl: "https://example.org/generic" });
    expect(scored.score).toBeLessThan(55);
    expect(scored.caseSlugs).toEqual([]);
  });
});
