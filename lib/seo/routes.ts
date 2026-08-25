export const SITE_ORIGIN = "https://econmind.group";

/**
 * Stable, canonical pages that are public under the central page-access policy.
 * Parameter-driven pages are intentionally omitted because they do not have a
 * unique path-based canonical URL yet.
 */
export const INDEXABLE_STATIC_ROUTES = [
  "/",
  "/about",
  "/cases",
  "/community",
  "/community-guidelines",
  "/daily-brief",
  "/daily-brief/archive",
  "/explore",
  "/integrity",
  "/league",
  "/league/about",
  "/league/schools",
  "/league/season",
  "/league/standings",
  "/league/teams",
  "/legal",
  "/privacy",
  "/team",
  "/terms",
] as const;

/**
 * Known account, invitation, administration, and interactive-workspace routes.
 * robots.txt is only crawl guidance; the existing authorization model remains
 * responsible for protecting every restricted page and its data.
 */
export const NON_PUBLIC_ROUTE_PREFIXES = [
  "/activities",
  "/admin",
  "/cases/history",
  "/contact",
  "/country",
  "/dashboard",
  "/dev",
  "/econbench",
  "/experiments",
  "/league/arena",
  "/league/behavioural-lab",
  "/league/command-centre",
  "/league/competitions",
  "/league/constitution-lab",
  "/league/crisis-sprint",
  "/league/dashboard",
  "/league/join",
  "/league/market-strategy",
  "/league/model-battle",
  "/league/quick-challenge",
  "/league/replay",
  "/league/scenario-studio",
  "/league/school-curriculum",
  "/league/world",
  "/library",
  "/lobby",
  "/mechanism-arena",
  "/models",
  "/policy-lab",
  "/professor",
  "/profile",
  "/replay",
  "/research",
  "/results",
  "/room",
  "/sandbox",
  "/simulation",
  "/view",
  "/workspace",
  "/world",
] as const;

export function canonicalUrl(path: string) {
  return new URL(path, `${SITE_ORIGIN}/`).toString();
}

export function canonicalPageUrl(path: string) {
  const url = canonicalUrl(path);
  return path === "/" ? url : `${url}/`;
}
