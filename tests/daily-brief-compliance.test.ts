import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const feed = read("lib/daily-brief/feed.ts");
const list = read("components/daily-brief/brief-list.tsx");
const detail = read("components/daily-brief/brief-detail.tsx");
const home = read("components/home/home-daily-brief-preview.tsx");
const admin = read("components/daily-brief/admin-daily-brief.tsx");

describe("Daily Brief attribution and excerpt contract", () => {
  it("never uses RSS or Atom full-content bodies as a summary", () => {
    expect(feed).toContain('tagValue(block, "description") || tagValue(block, "summary")');
    expect(feed).not.toContain('tagValue(block, "content")');
    expect(feed).not.toContain('tagValue(block, "content:encoded")');
  });

  it("shows source dates and direct original links everywhere news is presented", () => {
    for (const component of [list, detail, home, admin]) {
      expect(component).toContain("published_source_at");
      expect(component).toContain("canonical_url");
    }
  });

  it("caps legacy display text and avoids partnership claims", () => {
    for (const component of [list, detail, home, admin]) {
      expect(component).toContain("SUMMARY_DISPLAY_LIMIT = 360");
      expect(component).toContain("partnership");
    }
  });

  it("keeps stale published news in the archive instead of presenting it as current", () => {
    expect(list).toContain("archive ? filtered : filtered.filter");
    expect(list).toContain("isFreshCandidate");
    expect(home).toContain("items.find");
    expect(home).toContain("isFreshCandidate");
    expect(list).not.toContain("Today’s economic context");
  });
});
