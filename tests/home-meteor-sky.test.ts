import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("home sky decoration", () => {
  const home = readFileSync("components/home/editorial-home.tsx", "utf8");
  const css = readFileSync("app/visual-pilot-city.css", "utf8");
  it("keeps shooting stars inside the home hero and out of the accessibility tree", () => {
    expect(home).toContain('<div className="home-sky-motion" aria-hidden="true">');
    expect(home.match(/home-meteor home-meteor-/g)).toHaveLength(3);
    expect(css).toContain(".visual-pilot .home-sky-motion");
    expect(css).toContain("pointer-events:none");
  });
  it("respects reduced motion and the existing motion switch", () => {
    expect(css).toContain("@media(prefers-reduced-motion:reduce)");
    expect(css).toContain(".visual-pilot[data-motion=off] .home-meteor");
  });
});
