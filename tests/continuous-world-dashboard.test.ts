import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const dashboard = readFileSync(
  "components/world/continuous-world-dashboard.tsx",
  "utf8",
);

// Recreated minimal gate: the scrollable history timeline must keep a
// visible desktop scrollbar (no slim-thumb override on the max-h-60 grid).
describe("continuous world dashboard", () => {
  it("keeps the history timeline scrollable with a visible desktop scrollbar", () => {
    expect(dashboard).toContain("World history & Replay");
    const scrollableGrid = dashboard.match(
      /<div className="[^"]*max-h-60[^"]*overflow-y-auto[^"]*"/,
    );
    expect(scrollableGrid).not.toBeNull();
    expect(scrollableGrid?.[0]).not.toContain("scroll-slim");
  });

  it("renders the core world sections", () => {
    for (const heading of [
      "Fictional World Map",
      "Rolling world ranking",
      "Country & roles",
      "Policy desk",
      "Trade & contracts",
      "World supervisor control",
    ]) {
      expect(dashboard).toContain(heading);
    }
  });
});
