import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { AVAILABLE_MODELS } from "@/lib/models/registry";
import { availableNavigationSections } from "@/lib/platform/feature-flags";
import { GLOBAL_SEARCH_INDEX } from "@/lib/platform/search-catalog";
import {
  buildGlobalSearchIndex,
  filterModelsForSearch,
  searchGlobalIndex,
} from "@/lib/platform/search-index";
import { SIMULATION_NAVIGATION_ITEMS } from "@/lib/platform/simulation-navigation";

describe("global feature search", () => {
  it("derives every enabled navigation destination and available model from canonical registries", () => {
    const sections = availableNavigationSections();
    const visibleModels = filterModelsForSearch(sections, AVAILABLE_MODELS);
    const expectedHrefs = new Set([
      ...sections.flatMap((section) => [
        section.href,
        ...section.children.map((child) => child.href),
      ]),
      ...(sections.some((section) => section.id === "simulation")
        ? SIMULATION_NAVIGATION_ITEMS.map((item) => item.href)
        : []),
      ...visibleModels.map((model) => model.route),
    ]);
    const indexedHrefs = new Set(
      GLOBAL_SEARCH_INDEX.map((entry) => entry.href),
    );

    expect([...indexedHrefs].sort()).toEqual([...expectedHrefs].sort());
    expect(GLOBAL_SEARCH_INDEX).toHaveLength(indexedHrefs.size);
    expect(
      GLOBAL_SEARCH_INDEX.every((entry) => !entry.href.includes("[")),
    ).toBe(true);
    expect(
      GLOBAL_SEARCH_INDEX.every((entry) => !entry.href.startsWith("/admin")),
    ).toBe(true);
  });

  it("automatically indexes a future registered feature without a search-specific list", () => {
    const index = buildGlobalSearchIndex([
      {
        href: "/forecast-studio/",
        label: "Forecasting",
        description: "Explore forecasting tools.",
        children: [
          {
            href: "/forecast-studio",
            label: "Forecast Studio",
            description: "Build a transparent economic forecast.",
            keywords: ["nowcast", "预测"],
          },
        ],
      },
    ]);

    expect(index).toHaveLength(1);
    expect(index[0]).toMatchObject({
      href: "/forecast-studio",
      label: "Forecast Studio",
      group: "Forecasting",
    });
    expect(
      searchGlobalIndex(index, "nowcast").map((entry) => entry.href),
    ).toEqual(["/forecast-studio"]);
    expect(searchGlobalIndex(index, "预测").map((entry) => entry.href)).toEqual(
      ["/forecast-studio"],
    );
    expect(
      searchGlobalIndex(index, "Forecasting").map((entry) => entry.href),
    ).toEqual(["/forecast-studio"]);
  });

  it("excludes models whose owning navigation area is not visible", () => {
    const sections = [
      {
        href: "/models",
        label: "Learn",
        description: "Visible learning area.",
        children: [],
      },
    ];
    const models = [
      { route: "/models/future", title: "Future Model" },
      { route: "/sandbox", title: "Hidden Sandbox" },
      { route: "/private-tool", title: "Private Tool" },
    ];

    expect(
      filterModelsForSearch(sections, models).map((model) => model.route),
    ).toEqual(["/models/future"]);
    expect(filterModelsForSearch([], models)).toEqual([]);
  });

  it("ranks labels ahead of metadata matches and handles punctuation, case, and result limits", () => {
    const rankingFixture = buildGlobalSearchIndex([
      {
        href: "/metadata-match",
        label: "Research Lab",
        description: "Includes Forecast Studio material.",
        children: [],
      },
      {
        href: "/label-match",
        label: "Forecast Studio",
        description: "Exact label match.",
        children: [],
      },
    ]);

    expect(searchGlobalIndex(rankingFixture, "forecast studio")[0]?.href).toBe(
      "/label-match",
    );
    expect(
      searchGlobalIndex(GLOBAL_SEARCH_INDEX, "  SUPPLY & demand  ")[0],
    ).toMatchObject({
      href: "/models/supply-demand",
      label: "Supply & Demand",
    });
    expect(
      searchGlobalIndex(GLOBAL_SEARCH_INDEX, "market equilibrium")[0]?.href,
    ).toBe("/models/supply-demand");
    expect(
      searchGlobalIndex(GLOBAL_SEARCH_INDEX, "quick challenge")[0],
    ).toMatchObject({
      href: "/simulation/quick-challenge",
      group: "Simulation",
    });
    expect(searchGlobalIndex(GLOBAL_SEARCH_INDEX, "model", 3)).toHaveLength(3);
    expect(searchGlobalIndex(GLOBAL_SEARCH_INDEX, "does-not-exist")).toEqual(
      [],
    );
  });

  it("keeps the global shell integration small and exposes keyboard-accessible dialog semantics", () => {
    const navbar = readFileSync("components/layout/navbar.tsx", "utf8");
    const search = readFileSync("components/layout/global-search.tsx", "utf8");
    const catalog = readFileSync("lib/platform/search-catalog.ts", "utf8");

    expect(navbar).toContain("<GlobalSearch />");
    expect(catalog).toContain("availableNavigationSections");
    expect(catalog).toContain("AVAILABLE_MODELS");
    expect(catalog).toContain("SIMULATION_NAVIGATION_ITEMS");
    expect(catalog).not.toContain("NAVIGATION_SECTIONS");
    expect(catalog).not.toContain("MODEL_REGISTRY");
    expect(search).toContain("createPortal");
    expect(search).toContain('aria-keyshortcuts="Control+K Meta+K"');
    expect(search).toContain('role="dialog"');
    expect(search).toContain('role="combobox"');
    expect(search).toContain('role="listbox"');
    expect(search).toContain('event.key === "Escape"');
    expect(search).toContain('event.key === "ArrowDown"');
    expect(search).toContain("event.nativeEvent.isComposing");
    expect(search).toContain("event.isComposing");
    expect(search).toContain("scrollIntoView");
    expect(search).toContain("styles.dialog");
  });
});
