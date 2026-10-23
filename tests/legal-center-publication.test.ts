import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { Marked } from "marked";
import sanitizeHtml from "sanitize-html";
import sourceManifest from "@/content/legal/source-manifest.json";
import { compiledPolicy, readPolicySource } from "@/lib/legal/documents";
import {
  canonicalPolicyLink,
  publicationBody,
  renderPolicyMarkdown,
} from "@/lib/legal/markdown";
import { LEGAL_POLICY_DOCUMENTS } from "@/lib/legal/document-registry";
import { LEGAL_DOCUMENTS, LEGAL_RECONSENT } from "@/lib/legal/legal-config";
import {
  LEGACY_POLICY_ANCHORS,
  migratedPolicyHash,
} from "@/lib/legal/legacy-links";
import { isPublicPage } from "@/lib/platform/access-control";
import { NAVIGATION_SECTIONS } from "@/lib/platform/feature-flags";
import { INDEXABLE_STATIC_ROUTES } from "@/lib/seo/routes";

const plain = (html: string) =>
  sanitizeHtml(
    html.replace(/<a class="policy-anchor"[^>]*>#[\s\S]*?<\/a>/g, ""),
    { allowedTags: [], allowedAttributes: {} },
  )
    .replace(/\s+/g, " ")
    .trim();

describe("approved Legal Center publication", () => {
  it("imports only the ten approved public source files, unchanged", () => {
    expect(sourceManifest).toHaveLength(10);
    expect(readdirSync("content/legal").sort()).toEqual(
      [
        ...sourceManifest.map((entry) => entry.file),
        "source-manifest.json",
      ].sort(),
    );
    for (const entry of sourceManifest) {
      const bytes = readFileSync(`content/legal/${entry.file}`);
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(
        entry.sha256,
      );
      expect(entry.sourceName).not.toMatch(
        /0[89]_|1[0-5]_|\.docx|baseline|review_sources/,
      );
    }
  });
  for (const entry of sourceManifest)
    it(`preserves every body text token in ${entry.file}`, () => {
      const body = publicationBody(
        readPolicySource(entry.file),
        entry.file === "legal-index.md",
      );
      const expected = new Marked({ gfm: true }).parse(body) as string;
      const rendered = compiledPolicy(entry.file);
      expect(plain(rendered.html)).toBe(plain(expected));
      expect(rendered.html).not.toContain("Proposed version");
      expect(rendered.html).not.toContain("Not yet effective");
      expect(rendered.html).not.toMatch(/href="EconMind_World_.*\.md/);
    });
  it("publishes every new canonical route publicly and in the sitemap", () => {
    for (const document of LEGAL_POLICY_DOCUMENTS) {
      expect(isPublicPage(document.route)).toBe(true);
      expect(INDEXABLE_STATIC_ROUTES).toContain(
        document.route.replace(/\/$/, ""),
      );
      const compiled = compiledPolicy(document.file);
      expect(compiled.html.length).toBeGreaterThan(5000);
      expect(new Set(compiled.headings.map((heading) => heading.id)).size).toBe(
        compiled.headings.length,
      );
      for (const heading of compiled.headings)
        expect(compiled.html).toContain(`id="${heading.id}"`);
    }
    for (const route of ["/legal", "/legal/world", "/about"])
      expect(isPublicPage(route)).toBe(true);
  });
  it("resolves cross-file links and their World section anchor", () => {
    expect(
      canonicalPolicyLink(
        "EconMind_World_Terms_of_Use.md#08-permitted-non-commercial-sharing",
      ),
    ).toBe("/legal/world/terms/#08-permitted-non-commercial-sharing");
    expect(
      compiledPolicy("world-terms.md").headings.map((heading) => heading.id),
    ).toContain("08-permitted-non-commercial-sharing");
    expect(
      compiledPolicy("world-privacy.md").headings.some((heading) =>
        heading.title.includes("&amp;"),
      ),
    ).toBe(false);
    expect(canonicalPolicyLink("https://econmind.group/privacy/#choices")).toBe(
      "/legal/privacy/#8-security-and-rights",
    );
    expect(canonicalPolicyLink("https://world.econmind.group/")).toBe(
      "https://world.econmind.group/",
    );
    expect(canonicalPolicyLink("https://other.example/privacy/")).toBe(
      "https://other.example/privacy/",
    );
  });
  it("supports tables, nested lists, H1–H4, strong, emphasis and safe links", () => {
    const html = renderPolicyMarkdown(
      "# One\n## Two\n### Three\n#### Four\n\n**bold** and *italic* [link](https://example.com)\n\n1. first\n   - nested\n\n| A | B |\n|---|---|\n|a|b|\n\n<script>alert(1)</script>\n[x](javascript:alert%281%29)",
    ).html;
    for (const token of [
      "<h2",
      "<h3",
      "<h4",
      "<ol",
      "<ul",
      "<strong",
      "<em",
      "<table",
      "policy-table-scroll",
      'tabindex="0"',
    ])
      expect(html).toContain(token);
    expect(html).not.toMatch(/<script|href="javascript:/);
  });
  it("maps all historic anchors to real new sections", () => {
    for (const [document, aliases] of Object.entries(LEGACY_POLICY_ANCHORS)) {
      const ids = compiledPolicy(`${document}.md`).headings.map(
        (heading) => heading.id,
      );
      for (const [previous, next] of Object.entries(aliases)) {
        expect(ids).toContain(next);
        expect(migratedPolicyHash(document, `#${previous}`)).toBe(`#${next}`);
      }
    }
  });
  it("retains a single More group and both scoped document collections", () => {
    const group = NAVIGATION_SECTIONS.find(
      (section) => section.id === "community-legal",
    )!;
    for (const document of LEGAL_POLICY_DOCUMENTS.filter(
      (item) => item.scope === "platform",
    ))
      expect(group.children.map((item) => item.href)).toContain(document.route);
    expect(group.children.map((item) => item.href)).toContain("/legal/world/");
    expect(NAVIGATION_SECTIONS.map((section) => section.id)).not.toContain(
      "legal",
    );
    expect(readFileSync("components/layout/navbar.tsx", "utf8")).toContain(
      "max-h-[calc(100dvh-96px)] overflow-y-auto",
    );
    expect(readFileSync("components/layout/navbar.tsx", "utf8")).not.toContain('onMouseEnter={() => setOpenSection("desktop-more")}');
  });
  it("activates the separately authorised v2 confirmation without upgrading old records", () => {
    expect(LEGAL_DOCUMENTS.terms.version).toBe("2.0");
    expect(LEGAL_DOCUMENTS.privacy.version).toBe("2.0");
    expect(LEGAL_RECONSENT).toEqual({ terms: true, privacy: true });
    for (const file of [
      "components/auth/auth-dialog.tsx",
      "components/auth/account-onboarding.tsx",
    ])
      expect(readFileSync(file, "utf8")).toContain(
        "<RegistrationPolicyFields",
      );
  });
  it("retains World fictional-universe and copyright declarations without enlarging their scope", () => {
    const text = readPolicySource("world-about.md");
    expect(text).toContain("ECONMIND WORLD IS NOT EARTH.");
    expect(text).toContain(
      "© 2026 Samuel. Created by Samuel, operated under EconMind. All rights reserved.",
    );
    expect(text).toContain("70");
    expect(text).toContain("Six Core Offices");
    expect(readPolicySource("terms.md")).toContain(
      "Separately governed services, including EconMind World and Season 1, are outside this set of policies",
    );
  });
});
