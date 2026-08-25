import { describe, expect, it } from "vitest";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import { ECONOMIC_CASES } from "@/lib/cases/definitions";
import { isPublicPage } from "@/lib/platform/access-control";
import {
  INDEXABLE_STATIC_ROUTES,
  NON_PUBLIC_ROUTE_PREFIXES,
  SITE_ORIGIN,
} from "@/lib/seo/routes";

describe("SEO metadata routes", () => {
  it("publishes each stable public route and published case exactly once", () => {
    const entries = sitemap();
    const urls = entries.map((entry) => entry.url);
    const publishedCases = ECONOMIC_CASES.filter(
      (economicCase) => economicCase.status === "published",
    );

    expect(entries).toHaveLength(
      INDEXABLE_STATIC_ROUTES.length + publishedCases.length,
    );
    expect(new Set(urls).size).toBe(urls.length);

    for (const economicCase of publishedCases) {
      expect(urls).toContain(`${SITE_ORIGIN}/cases/${economicCase.slug}/`);
    }
  });

  it("uses only production HTTPS URLs without query strings or restricted paths", () => {
    for (const entry of sitemap()) {
      const url = new URL(entry.url);
      expect(url.origin).toBe(SITE_ORIGIN);
      expect(url.protocol).toBe("https:");
      expect(url.search).toBe("");
      expect(url.hash).toBe("");
      expect(url.pathname).toMatch(/\/$/);
      expect(isPublicPage(url.pathname)).toBe(true);
      expect(
        NON_PUBLIC_ROUTE_PREFIXES.some(
          (prefix) =>
            url.pathname === prefix || url.pathname.startsWith(`${prefix}/`),
        ),
      ).toBe(false);
      expect(entry.lastModified).toBeUndefined();
    }
  });

  it("allows normal crawlers while excluding known non-public areas", () => {
    const output = robots();
    const rules = Array.isArray(output.rules) ? output.rules : [output.rules];
    const wildcardRule = rules.find((rule) => rule.userAgent === "*");

    expect(output.sitemap).toBe(`${SITE_ORIGIN}/sitemap.xml`);
    expect(wildcardRule).toBeDefined();
    expect(wildcardRule?.allow).toBe("/");
    expect(wildcardRule?.disallow).toEqual([...NON_PUBLIC_ROUTE_PREFIXES]);
    expect(wildcardRule?.disallow).not.toContain("/");
    for (const prefix of NON_PUBLIC_ROUTE_PREFIXES) {
      expect(isPublicPage(prefix)).toBe(false);
    }
  });
});
