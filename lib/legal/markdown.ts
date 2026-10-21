import { Marked, Renderer, type Tokens } from "marked";
import sanitizeHtml from "sanitize-html";
import { withBasePath } from "@/lib/base-path";
import { LEGACY_POLICY_ROUTES } from "@/lib/legal/publication";
import { migratedPolicyHash } from "@/lib/legal/legacy-links";

export type PolicyHeading = { id: string; title: string; level: number };
const worldFiles: Record<string, string> = {
  "EconMind_World_About.md": "/legal/world/about/",
  "EconMind_World_Terms_of_Use.md": "/legal/world/terms/",
  "EconMind_World_Privacy_Notice.md": "/legal/world/privacy/",
};
const escapeAttribute = (text: string) =>
  text
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

export function canonicalPolicyLink(href: string) {
  const [pathWithQuery, fragment] = href.split("#", 2);
  const suffix = fragment ? `#${fragment}` : "";
  const world = worldFiles[pathWithQuery.replace(/^\.\//, "")];
  if (world) return `${withBasePath(world)}${suffix}`;
  // Only the platform's own origin is converted into a local canonical route.
  const local = pathWithQuery.replace(
    /^https:\/\/(?:www\.)?econmind\.group(?=\/|$)/i,
    "",
  );
  if (!local.startsWith("/") || local.startsWith("//")) return href;
  const [pathname, query] = local.split("?", 2);
  const canonical =
    LEGACY_POLICY_ROUTES[
      pathname.replace(/\/+$/, "") as keyof typeof LEGACY_POLICY_ROUTES
    ] || pathname;
  const document = canonical.match(/^\/legal\/([^/]+)\/$/)?.[1];
  return `${withBasePath(canonical)}${query ? `?${query}` : ""}${document ? migratedPolicyHash(document, suffix) : suffix}`;
}

export function headingSlug(text: string) {
  return sanitizeHtml(text, { allowedTags: [], allowedAttributes: {} })
    .replace(/[*_`]/g, "")
    .toLowerCase()
    .replace(/&amp;/g, "&")
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .trim()
    .replace(/\s/g, "-");
}

/** Only technical publication preamble and route instructions are adapted. */
export function publicationBody(source: string, index = false) {
  let body = source
    .replace(/^# .+\r?\n/, "")
    .replace(
      /^Proposed (?:version 2\.0|alignment copy) • Review revision R2 dated 21 October 2026 • Not yet effective\r?\n/gm,
      "",
    )
    .trim();
  if (index)
    body = body
      .replace(
        "The approved publication will state an effective date and link the matching versions below.",
        "The publication register below identifies the website versions and publication information.",
      )
      .replace(
        "Proposed website route: /intellectual-property/ — to be created only in an authorised publication change.",
        "Website route: /legal/intellectual-property/.",
      )
      .replace(
        "The Intellectual Property Policy route is proposed until created in an authorised release. ",
        "",
      )
      .replace(
        "Publication register to complete on approval: document title, approved version, effective date and link to the prior version where available.",
        "The publication register below records the document titles, website versions, publication information and available prior versions.",
      );
  return body.replace(
    /(Website route: )\/(terms|privacy|community-guidelines|integrity)\//g,
    "$1/legal/$2/",
  );
}

/** Fresh parser/slug state for each document; safe static HTML, not client Markdown. */
export function renderPolicyMarkdown(markdown: string) {
  const headings: PolicyHeading[] = [];
  const seen = new Map<string, number>();
  const links: string[] = [];
  const renderer = new Renderer();
  renderer.heading = function (token: Tokens.Heading) {
    const base = headingSlug(token.text) || "section";
    const count = seen.get(base) || 0;
    seen.set(base, count + 1);
    const id = count ? `${base}-${count}` : base;
    // Heading labels are React text, not HTML. Use source text so '&' is not
    // double-escaped to a visible '&amp;' in the table of contents.
    const title = token.text.replace(/[*_`]/g, "").replace(/<[^>]*>/g, "");
    const level = Math.max(2, token.depth); // Preserve order; the page owns its single H1.
    headings.push({ id, title, level });
    return `<h${level} id="${escapeAttribute(id)}" tabindex="-1">${this.parser.parseInline(token.tokens)}<a class="policy-anchor" href="#${escapeAttribute(id)}" aria-label="Link to ${escapeAttribute(title)}">#</a></h${level}>\n`;
  };
  renderer.link = function (token: Tokens.Link) {
    const href = canonicalPolicyLink(token.href);
    links.push(href);
    const external = /^https?:\/\//i.test(href);
    return `<a href="${escapeAttribute(href)}"${token.title ? ` title="${escapeAttribute(token.title)}"` : ""}${external ? ' rel="noopener noreferrer"' : ""}>${this.parser.parseInline(token.tokens)}</a>`;
  };
  const originalTable = renderer.table;
  renderer.table = function (token: Tokens.Table) {
    return `<div class="policy-table-scroll" role="region" aria-label="Policy table" tabindex="0">${originalTable.call(this, token)}</div>`;
  };
  const parser = new Marked({ gfm: true, renderer, async: false });
  const html = sanitizeHtml(parser.parse(markdown) as string, {
    allowedTags: [
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "p",
      "a",
      "strong",
      "em",
      "ul",
      "ol",
      "li",
      "table",
      "thead",
      "tbody",
      "tr",
      "th",
      "td",
      "blockquote",
      "hr",
      "br",
      "code",
      "pre",
      "div",
      "del",
    ],
    allowedAttributes: {
      a: ["href", "title", "rel", "class", "aria-label"],
      "*": ["id", "tabindex"],
      div: ["class", "role", "aria-label", "tabindex"],
      ol: ["start"],
      th: ["align"],
      td: ["align"],
    },
    allowedSchemes: ["https", "http", "mailto"],
    allowProtocolRelative: false,
  });
  return { html, headings, links };
}
