import type { AppRole } from "@/lib/experiments/types";
import type { LeaguePlatformRole } from "@/lib/league/types";

export type PageAudience = "public" | "account-or-viewer" | "account";

export type PageAccessPolicy = {
  audience: PageAudience;
  appRoles?: readonly Exclude<AppRole, "guest">[];
  platformRoles?: readonly LeaguePlatformRole[];
  roleMatch?: "all" | "any";
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
  // The reading archive is public, while authoring and review stay tied to an
  // individual account and the established platform administrator role.
  { path: "/learn/research/admin", match: "prefix", audience: "account", platformRoles: ["platform_admin"] },
  { path: "/learn/research/submit", match: "prefix", audience: "account" },
  { path: "/learn/research/my", match: "prefix", audience: "account" },
  { path: "/learn/research", match: "prefix", audience: "public" },

  // Simulation is an open learning surface. Its individual management and
  // authoring actions still enforce their own account and backend permissions.
  { path: "/simulation/dashboard", match: "prefix", audience: "account" },
  { path: "/simulation/join", match: "prefix", audience: "account" },
  { path: "/simulation/legacy-world/admin", match: "prefix", audience: "account", platformRoles: ["platform_admin"] },
  { path: "/simulation", match: "prefix", audience: "public" },

  // The Season 1 navigation entry is open to individual accounts, not viewers.
  // Active-account and action-specific permissions are enforced by its RPCs.
  { path: "/season1", match: "prefix", audience: "account" },

  // Governance work contains account requests and internal notes.
  { path: "/admin/governance", match: "prefix", audience: "account", platformRoles: ["platform_admin"] },
  { path: "/admin/live-world", match: "prefix", audience: "account", appRoles: ["teacher"], platformRoles: ["school_leader", "platform_admin"], roleMatch: "any" },
  { path: "/admin/live-auction", match: "prefix", audience: "account", appRoles: ["teacher"], platformRoles: ["school_leader", "platform_admin"], roleMatch: "any" },
  { path: "/admin/mail", match: "prefix", audience: "account", platformRoles: ["platform_admin"] },

  // Personal data is not part of the otherwise-public case library.
  { path: "/cases/history", match: "prefix", audience: "account" },

  // Independent academic authoring area.
  { path: "/professor", match: "prefix", audience: "account", appRoles: ["professor"] },

  // Public editorial and explanatory pages.
  { path: "/", audience: "public" },
  { path: "/about", audience: "public" },
  { path: "/community", audience: "public" },
  { path: "/legal", audience: "public" },
  { path: "/privacy", audience: "public" },
  { path: "/terms", audience: "public" },
  { path: "/community-guidelines", audience: "public" },
  { path: "/integrity", audience: "public" },
  { path: "/contact", audience: "account" },
  // A standalone invitation-only event: authentication happens through its
  // short-lived room session, not an ordinary EconMind account.
  { path: "/live-world", match: "prefix", audience: "public" },
  { path: "/live-auction", match: "prefix", audience: "public" },
  { path: "/explore", audience: "public" },
  { path: "/team", audience: "public" },
  { path: "/tiao-run", audience: "public" },
  { path: "/daily-brief", match: "prefix", audience: "public" },
  { path: "/cases", match: "prefix", audience: "public" },

  // Public League directory and released information. Workspaces, joining,
  // simulations and management pages intentionally remain account-gated.
  { path: "/league", audience: "public" },
  { path: "/league/about", audience: "public" },
  { path: "/league/schools", audience: "public" },
  { path: "/league/schools/profile", match: "prefix", audience: "public" },
  { path: "/league/teams", audience: "public" },
  // Legacy Season and simulation addresses only redirect to their new public
  // destinations; they no longer render League content.
  { path: "/league/season", audience: "public" },
  { path: "/league/standings", audience: "public" },
  { path: "/league/arena", match: "prefix", audience: "public" },
  { path: "/league/replay", match: "prefix", audience: "public" },
  { path: "/league/world", match: "prefix", audience: "public" },
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
  const appRoleAllowed = Boolean(policy.appRoles?.includes(role as Exclude<AppRole, "guest">));
  const platformRoleAllowed = Boolean(platformRole && policy.platformRoles?.includes(platformRole));
  if (policy.roleMatch === "any") return appRoleAllowed || platformRoleAllowed;
  if (!policy.appRoles && !policy.platformRoles) return true;
  if (!policy.appRoles) return platformRoleAllowed;
  if (!policy.platformRoles) return appRoleAllowed;
  return appRoleAllowed && platformRoleAllowed;
}

export function isPublicPage(pathname: string | null | undefined) {
  return pageAccessForPath(pathname).audience === "public";
}
