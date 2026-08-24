import { describe, expect, it } from "vitest";
import {
  DAILY_BRIEF_MAX_ITEMS_PER_DAY,
  DAILY_BRIEF_MAX_SOURCE_AGE_DAYS,
  isFreshCandidate,
  linkCases,
  normaliseText,
  remainingDailyBriefSlots,
  scoreCandidate,
  selectBriefsForReview,
  slugForBrief,
  stableFingerprint,
} from "@/lib/daily-brief/rules";

const NOW = new Date("2026-08-24T12:00:00.000Z");
const DAY_IN_MS = 24 * 60 * 60 * 1000;

describe("Daily Brief deterministic rules", () => {
  const candidate = { sourceId: "source-1", sourceName: "Official source", sourceUrl: "https://example.org/feed.xml", canonicalUrl: "https://example.org/article?utm=ignored", title: "Carbon tax reform and emissions trading", summary: "A public policy update explains carbon pricing, emissions reductions, and the distribution of revenue across households.", publishedSourceAt: "2026-08-24T08:00:00.000Z" };

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
    expect(slugForBrief(scored)).toMatch(/^2026-08-24-/);
  });

  it("does not pretend generic short content has strong teaching relevance", () => {
    const scored = scoreCandidate({ ...candidate, title: "Update", summary: "Brief note.", canonicalUrl: "https://example.org/generic" });
    expect(scored.score).toBeLessThan(55);
    expect(scored.caseSlugs).toEqual([]);
  });

  it("accepts the exact seven-day boundary and rejects missing, stale, or clearly future dates", () => {
    const oldestAccepted = new Date(NOW.getTime() - DAILY_BRIEF_MAX_SOURCE_AGE_DAYS * DAY_IN_MS).toISOString();
    const justTooOld = new Date(Date.parse(oldestAccepted) - 1).toISOString();
    const latestTolerated = new Date(NOW.getTime() + DAY_IN_MS).toISOString();
    const clearlyFuture = new Date(NOW.getTime() + DAY_IN_MS + 1).toISOString();

    expect(isFreshCandidate({ publishedSourceAt: oldestAccepted }, NOW)).toBe(true);
    expect(isFreshCandidate({ publishedSourceAt: justTooOld }, NOW)).toBe(false);
    expect(isFreshCandidate({ publishedSourceAt: null }, NOW)).toBe(false);
    expect(isFreshCandidate({ publishedSourceAt: "not-a-date" }, NOW)).toBe(false);
    expect(isFreshCandidate({ publishedSourceAt: latestTolerated }, NOW)).toBe(true);
    expect(isFreshCandidate({ publishedSourceAt: clearlyFuture }, NOW)).toBe(false);
  });

  it("orders eligible briefs by source publication date before teaching score", () => {
    const olderHighScore = {
      ...scoreCandidate({ ...candidate, canonicalUrl: "https://example.org/older", publishedSourceAt: "2026-08-22T12:00:00.000Z" }),
      score: 99,
    };
    const newerLowerScore = {
      ...scoreCandidate({ ...candidate, canonicalUrl: "https://example.org/newer", publishedSourceAt: "2026-08-24T11:00:00.000Z" }),
      score: 60,
    };

    const selected = selectBriefsForReview([olderHighScore, newerLowerScore], 55, 2, NOW);
    expect(selected.map((item) => item.canonicalUrl)).toEqual([
      "https://example.org/newer",
      "https://example.org/older",
    ]);
  });

  it("limits each collection to four newest eligible review candidates", () => {
    const candidates = [92, 81, 76, 73, 99].map((score, index) => ({
      ...scoreCandidate({
        ...candidate,
        canonicalUrl: `https://example.org/${index}`,
        publishedSourceAt: new Date(NOW.getTime() - index * 60 * 60 * 1000).toISOString(),
      }),
      score,
    }));
    const selected = selectBriefsForReview(candidates, 55, DAILY_BRIEF_MAX_ITEMS_PER_DAY, NOW);
    expect(DAILY_BRIEF_MAX_ITEMS_PER_DAY).toBe(4);
    expect(selected.map((item) => item.canonicalUrl)).toEqual([
      "https://example.org/0",
      "https://example.org/1",
      "https://example.org/2",
      "https://example.org/3",
    ]);
  });

  it("can select a new item after known fingerprints are filtered before the cap", () => {
    const knownCandidates = Array.from({ length: DAILY_BRIEF_MAX_ITEMS_PER_DAY }, (_, index) => ({
      ...scoreCandidate({
        ...candidate,
        canonicalUrl: `https://example.org/known-${index}`,
        publishedSourceAt: new Date(NOW.getTime() - index * 60 * 60 * 1000).toISOString(),
      }),
      score: 90 - index,
    }));
    const newCandidate = {
      ...scoreCandidate({
        ...candidate,
        canonicalUrl: "https://example.org/new-item",
        publishedSourceAt: new Date(NOW.getTime() - 5 * 60 * 60 * 1000).toISOString(),
      }),
      score: 60,
    };
    const knownFingerprints = new Set(knownCandidates.map((item) => item.fingerprint));
    const unseenCandidates = [...knownCandidates, newCandidate].filter(
      (item) => !knownFingerprints.has(item.fingerprint),
    );

    expect(selectBriefsForReview(unseenCandidates, 55, DAILY_BRIEF_MAX_ITEMS_PER_DAY, NOW))
      .toEqual([newCandidate]);
  });

  it("does not exceed the daily collection limit across manual runs", () => {
    expect(remainingDailyBriefSlots(0)).toBe(4);
    expect(remainingDailyBriefSlots(3)).toBe(1);
    expect(remainingDailyBriefSlots(4)).toBe(0);
    expect(remainingDailyBriefSlots(10)).toBe(0);
  });
});
