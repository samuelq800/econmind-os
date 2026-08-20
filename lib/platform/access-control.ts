import type { AppRole } from "@/lib/experiments/types";
import type { LeaguePlatformRole } from "@/lib/league/types";

export type PageAudience = "public" | "account-or-viewer" | "account";

export type PageAccessPolicy = {
  audience: PageAudience;
  appRoles?: readonly Exclude<AppRole, "guest">[];
  platformRoles?: readonly LeaguePlatformRole[];
};

type PageAccessRule = PageAccessPolicy & {
  path: string;
  match?: "exact" | "prefix";
};

const ACCOUNT_OR_VIEWER: PageAccessPolicy = { audience: "account-or-viewer" };

/**
 * Frontend page visibility lives here so direct URLs and navigation can share
 * one policy. More-specific exceptions must appear before broader prefixes.
 * This is a UI boundary; backend authorization remains a separate concern.
 */
export const PAGE_ACCESS_RULES: readonly PageAccessRule[] = [
  // Personal data is not part of the otherwise-public case library.
  { path: "/cases/history", match: "prefix", audience: "account" },

  // Independent academic authoring area.
  { path: "/professor", match: "prefix", audience: "account", appRoles: ["professor"] },

  // Public editorial and explanatory pages.
  { path: "/", audience: "public" },
  { path: "/about", audience: "public" },
  { path: "/explore", audience: "public" },
  { path: "/team", audience: "public" },
  { path: "/daily-brief", match: "prefix", audience: "public" },
  { path: "/cases", match: "prefix", audience: "public" },

  // Public League directory and released information. Workspaces, joining,
  // simulations and management pages intentionally remain account-gated.
  { path: "/league", audience: "public" },
  { path: "/league/about", audience: "public" },
  { path: "/league/schools", audience: "public" },
  { path: "/league/schools/profile", match: "prefix", audience: "public" },
  { path: "/league/teams", audience: "public" },
  { path: "/league/season", audience: "public" },
  { path: "/league/standings", audience: "public" },
] as const;

export function normalisePagePath(pathname: string | null | undefined) {
  const withoutBasePath = (pathname || "/").replace(/^\/econmind-os(?=\/|$)/, "");
  if (withoutBasePath === "/") return "/";
  return withoutBasePath.replace(/\/+$/, "") || "/";
}

function matchesRule(pathname: string, rule: PageAccessRule) {
  if (rule.match !== "prefix") return pathname === rule.path;
  return pathname === rule.path || pathname.startsWith(`${rule.path}/`);
}

export function pageAccessForPath(pathname: string | null | undefined): PageAccessPolicy {
  const normalisedPath = normalisePagePath(pathname);
  return PAGE_ACCESS_RULES.find((rule) => matchesRule(normalisedPath, rule)) ?? ACCOUNT_OR_VIEWER;
}

export function hasRequiredPageRole(
  policy: PageAccessPolicy,
  role: AppRole,
  platformRole: LeaguePlatformRole | null,
) {
  const appRoleAllowed = !policy.appRoles || policy.appRoles.includes(role as Exclude<AppRole, "guest">);
  const platformRoleAllowed = !policy.platformRoles || Boolean(platformRole && policy.platformRoles.includes(platformRole));
  return appRoleAllowed && platformRoleAllowed;
}

export function isPublicPage(pathname: string | null | undefined) {
  return pageAccessForPath(pathname).audience === "public";
}
