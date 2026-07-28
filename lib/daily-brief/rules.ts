import type { FeedCandidate, ScoredCandidate } from "./types";

const caseRules: Array<{ slug: string; tags: string[]; keywords: string[] }> = [
  { slug: "oil-price-shock", tags: ["energy", "inflation", "macroeconomics"], keywords: ["oil", "energy", "opec", "crude", "fuel", "supply shock"] },
  { slug: "carbon-tax", tags: ["climate", "externalities", "policy"], keywords: ["carbon", "emissions", "climate", "greenhouse", "ets"] },
  { slug: "housing-rent-control", tags: ["housing", "price-controls"], keywords: ["housing", "rent", "rental", "tenant", "property"] },
  { slug: "minimum-wage", tags: ["labour", "wages"], keywords: ["wage", "labour", "labor", "employment", "job"] },
  { slug: "tariff-conflict", tags: ["trade", "tariffs"], keywords: ["tariff", "trade", "import", "export", "customs", "retaliat"] },
  { slug: "restaurant-food-waste", tags: ["food-waste", "business"], keywords: ["food waste", "restaurant", "hospitality", "perishable", "food service"] },
];

const strip = (value: string) => value.replace(/<[^>]*>/g, " ").replace(/&(?:amp|quot|#39|lt|gt);/g, " ").replace(/\s+/g, " ").trim();
export function normaliseText(value: string) { return strip(value).toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim(); }
export function stableFingerprint(title: string, url: string) {
  const input = `${normaliseText(title)}|${url.replace(/[?#].*$/, "").toLowerCase()}`;
  let h1 = 0x811c9dc5; let h2 = 0x01000193;
  for (let i = 0; i < input.length; i += 1) { h1 = Math.imul(h1 ^ input.charCodeAt(i), 16777619); h2 = Math.imul(h2 ^ input.charCodeAt(i), 2246822519); }
  return `${(h1 >>> 0).toString(16).padStart(8, "0")}${(h2 >>> 0).toString(16).padStart(8, "0")}${input.length.toString(16).padStart(4, "0")}`.padEnd(32, "0");
}
export function linkCases(title: string, summary: string) {
  const text = normaliseText(`${title} ${summary}`); const found = caseRules.filter((rule) => rule.keywords.some((keyword) => text.includes(keyword))).slice(0, 3);
  return { caseSlugs: found.map((rule) => rule.slug), tags: [...new Set(found.flatMap((rule) => rule.tags))].slice(0, 6) };
}
export function scoreCandidate(candidate: FeedCandidate): ScoredCandidate {
  const cleanedTitle = strip(candidate.title); const cleanedSummary = strip(candidate.summary); const linked = linkCases(cleanedTitle, cleanedSummary);
  const hasSummary = cleanedSummary.length >= 80 ? 20 : cleanedSummary.length >= 35 ? 12 : 4;
  const topical = Math.min(40, linked.caseSlugs.length * 20 + linked.tags.length * 2);
  const source = 20; const specific = /\d|policy|market|price|tax|wage|trade|inflation|emission/i.test(`${cleanedTitle} ${cleanedSummary}`) ? 12 : 5;
  const score = Math.min(100, hasSummary + topical + source + specific + (cleanedTitle.length >= 20 ? 8 : 3));
  return { ...candidate, title: cleanedTitle, summary: cleanedSummary.slice(0, 5000), tags: linked.tags, caseSlugs: linked.caseSlugs, score, breakdown: { summary: hasSummary, topical, source, specificity: specific, title: cleanedTitle.length >= 20 ? 8 : 3 }, fingerprint: stableFingerprint(cleanedTitle, candidate.canonicalUrl) };
}
export function slugForBrief(candidate: ScoredCandidate) { const date = (candidate.publishedSourceAt ?? new Date(0).toISOString()).slice(0, 10); return `${date}-${candidate.fingerprint.slice(0, 16)}`; }
