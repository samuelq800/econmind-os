import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const navbar = readFileSync("components/layout/navbar.tsx", "utf8");
const search = readFileSync("components/layout/global-search.tsx", "utf8");
const searchStyles = readFileSync(
  "components/layout/global-search.module.css",
  "utf8",
);
const globals = readFileSync("app/globals.css", "utf8");

describe("responsive global navigation", () => {
  it("keeps Beta visible and legible through hover states", () => {
    expect(navbar).toContain('className="brand-beta"');
    expect(navbar).not.toMatch(/className="[^"]*hidden[^"]*"[^>]*>Beta</);
    expect(globals).toContain(".brand-home-link:hover .brand-beta");
    expect(globals).toMatch(
      /\.brand-home-link:hover \.brand-beta[\s\S]*opacity: 1/,
    );
  });

  it("uses one bounded desktop navigation and keeps search separate", () => {
    expect(navbar).toContain("compactDesktopLinks.map");
    expect(navbar).toContain("compactOverflowLinks.map");
    expect(navbar).not.toContain("2xl:flex");
    expect(navbar).toContain("<GlobalSearch />");
    expect(searchStyles).toContain("@media (min-width: 1600px)");
  });

  it("gives mobile search and navigation safe full-height surfaces", () => {
    expect(navbar).toContain("mobile-nav-panel");
    expect(globals).toContain("env(safe-area-inset-top)");
    expect(search).toContain("styles.footer");
    expect(searchStyles).toContain("min-height: 100dvh");
    expect(searchStyles).toContain("env(safe-area-inset-bottom)");
  });
});
