import type { FeedCandidate } from "./types.ts";

export const DAILY_BRIEF_SOURCE_EXCERPT_MAX_CHARS = 360;

export type FeedSourceDescriptor = {
  id: string;
  name: string;
  feed_url: string;
};

const entityNames: Record<string, string> = {
  amp: "&",
  apos: "'",
  gt: ">",
  hellip: "…",
  lt: "<",
  mdash: "—",
  nbsp: " ",
  ndash: "–",
  quot: '"',
};

function decodeXmlEntities(value: string) {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#([0-9]+);/g, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&([a-z]+);/gi, (entity, name: string) => entityNames[name.toLowerCase()] ?? entity);
}

export function plainFeedText(value = "") {
  return decodeXmlEntities(
    value
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
      .replace(/<(?:script|style)\b[^>]*>[\s\S]*?<\/(?:script|style)>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  ).replace(/\s+/g, " ").trim();
}

export function truncateSourceExcerpt(value: string, maximum = DAILY_BRIEF_SOURCE_EXCERPT_MAX_CHARS) {
  const text = plainFeedText(value);
  if (text.length <= maximum) return text;
  const target = Math.max(1, maximum - 1);
  const initial = text.slice(0, target);
  const lastSpace = initial.lastIndexOf(" ");
  const shortened = lastSpace >= Math.floor(target * 0.65) ? initial.slice(0, lastSpace) : initial;
  return `${shortened.trimEnd()}…`;
}

const tagValue = (block: string, tag: string) =>
  new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i").exec(block)?.[1] ?? "";

function atomLink(block: string) {
  const links = block.match(/<link\b[^>]*>/gi) ?? [];
  const candidates = links.flatMap((tag) => {
    const href = /\bhref=["']([^"']+)["']/i.exec(tag)?.[1];
    const rel = /\brel=["']([^"']+)["']/i.exec(tag)?.[1]?.toLowerCase() ?? "alternate";
    return href ? [{ href: decodeXmlEntities(href), rel }] : [];
  });
  return candidates.find((link) => link.rel === "alternate")?.href
    ?? candidates.find((link) => link.rel !== "self")?.href
    ?? "";
}

function canonicalHttpsUrl(value: string, feedUrl: string) {
  try {
    const url = new URL(value, feedUrl);
    url.hash = "";
    return url.protocol === "https:" ? url.toString() : "";
  } catch {
    return "";
  }
}

/** Parse feed metadata only. Full article pages and feed content bodies are intentionally ignored. */
export function parseFeed(xml: string, source: FeedSourceDescriptor): FeedCandidate[] {
  const blocks = [
    ...(xml.match(/<item\b[\s\S]*?<\/item>/gi) ?? []),
    ...(xml.match(/<entry\b[\s\S]*?<\/entry>/gi) ?? []),
  ];

  return blocks.slice(0, 20).flatMap((block) => {
    const title = plainFeedText(tagValue(block, "title"));
    const rssLink = plainFeedText(tagValue(block, "link"));
    const canonicalUrl = canonicalHttpsUrl(rssLink || atomLink(block), source.feed_url);
    const summary = truncateSourceExcerpt(tagValue(block, "description") || tagValue(block, "summary"));
    const date = plainFeedText(tagValue(block, "pubDate") || tagValue(block, "published") || tagValue(block, "updated"));
    const parsedDate = Date.parse(date);

    if (!title || !canonicalUrl || !summary || !Number.isFinite(parsedDate)) return [];
    return [{
      sourceId: source.id,
      sourceName: source.name,
      sourceUrl: source.feed_url,
      canonicalUrl,
      title,
      summary,
      publishedSourceAt: new Date(parsedDate).toISOString(),
    }];
  });
}
