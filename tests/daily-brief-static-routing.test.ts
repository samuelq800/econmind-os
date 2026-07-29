import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const list = readFileSync(resolve(process.cwd(), "components/daily-brief/brief-list.tsx"), "utf8");
const reader = readFileSync(resolve(process.cwd(), "components/daily-brief/brief-reader.tsx"), "utf8");
const readerPage = readFileSync(resolve(process.cwd(), "app/daily-brief/read/page.tsx"), "utf8");

describe("Daily Brief static routing", () => {
  it("opens live Supabase briefs through a static GitHub Pages route", () => {
    expect(list).toContain("/daily-brief/read?brief=${encodeURIComponent(item.slug)}");
    expect(reader).toContain('useSearchParams().get("brief")');
  });

  it("keeps query-string reading behind a Suspense boundary for static export", () => {
    expect(readerPage).toContain("<Suspense");
    expect(readerPage).toContain("<BriefReader />");
  });
});
