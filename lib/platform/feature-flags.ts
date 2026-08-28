export const FEATURE_FLAGS = {
  dailyBrief: true,
  sandbox: true,
  modelWorkspace: true,
  modelPractice: true,
  modelComposer: true,
  modelCompare: false,
  modelValidation: false,
  econBench: true,
  mechanismArena: true,
  evidenceLab: true,
  evidenceUpload: false,
  // This is a public build flag, not a security mechanism. The database RLS
  // and server worker remain the authority. It keeps the route out of normal
  // navigation until a validated calibration package and live worker exist.
  worldEconomy: process.env.NEXT_PUBLIC_ENABLE_CONTINUOUS_WORLD === "true",
  league: true,
  publicLeaderboard: false,
  counterfactual: false,
  aiExplanation: false,
} as const;

export type FeatureFlag = keyof typeof FEATURE_FLAGS;
export type ProductSystem = "learning-research" | "world-economy" | "shared";

export type PlatformNavigationItem = {
  href: string;
  label: string;
  system: ProductSystem;
  feature?: FeatureFlag;
  description?: string;
};

/**
 * The single source of truth for the product's information architecture.
 * Routes deliberately remain where they are: these sections only regroup
 * existing entry points, so saved links and static GitHub Pages URLs keep
 * working. Simulation and League retain their dedicated secondary navigation.
 */
export type NavigationSection = {
  id: "explore" | "learn" | "lab" | "simulation" | "league" | "teams" | "community-legal" | "workspace";
  label: string;
  href: string;
  system: ProductSystem;
  feature?: FeatureFlag;
  description: string;
  children: readonly PlatformNavigationItem[];
};

export const NAVIGATION_SECTIONS: readonly NavigationSection[] = [
  {
    id: "explore", label: "Explore", href: "/explore", system: "learning-research", feature: "dailyBrief",
    description: "Real-world economic discovery.",
    children: [
      { href: "/explore", label: "Explore overview", system: "learning-research", feature: "dailyBrief", description: "Choose a real-world question or pathway." },
      { href: "/daily-brief", label: "Daily Brief", system: "learning-research", feature: "dailyBrief", description: "Reviewed economic developments." },
      { href: "/cases", label: "Cases", system: "learning-research", description: "Applied economic cases." },
    ],
  },
  {
    id: "learn", label: "Learn", href: "/models", system: "learning-research", feature: "modelWorkspace",
    description: "Models, explanations and practice.",
    children: [
      { href: "/models", label: "Models", system: "learning-research", feature: "modelWorkspace", description: "Economic mechanisms and visual models." },
      { href: "/models/practice", label: "Model Practice", system: "learning-research", feature: "modelPractice", description: "Check understanding with versioned questions." },
      { href: "/models/composer", label: "Model Composer", system: "learning-research", feature: "modelComposer", description: "Connect existing models with explicit assumptions." },
    ],
  },
  {
    id: "lab", label: "Lab", href: "/sandbox", system: "learning-research", feature: "sandbox",
    description: "Standalone policy, evidence and experiment tools.",
    children: [
      { href: "/sandbox", label: "Economic Sandbox", system: "learning-research", feature: "sandbox", description: "Test policy changes in a controlled economy." },
      { href: "/policy-lab", label: "Policy Lab", system: "learning-research", description: "Build and compare policy packages." },
      { href: "/research", label: "Evidence Lab", system: "learning-research", feature: "evidenceLab", description: "Examine claims, methods and evidence." },
      { href: "/econbench", label: "EconBench", system: "learning-research", feature: "econBench", description: "Work through structured economic scenarios." },
      { href: "/experiments", label: "Experiments", system: "learning-research", description: "Run existing classroom experiments." },
      { href: "/mechanism-arena", label: "Mechanism Arena", system: "learning-research", feature: "mechanismArena", description: "Compare mechanisms in preset scenarios." },
      { href: "/activities", label: "Activity library", system: "learning-research", feature: "mechanismArena", description: "Browse existing practical activities." },
    ],
  },
  {
    id: "simulation", label: "Simulation", href: "/simulation", system: "world-economy", feature: "league",
    description: "Protected economic simulation experiences.",
    // SimulationNavigation remains the canonical, protected secondary navigation.
    children: [],
  },
  {
    id: "league", label: "League", href: "/league", system: "world-economy", feature: "league",
    description: "Cross-school competition and coordination.",
    children: [
      { href: "/league", label: "League home", system: "world-economy", feature: "league", description: "League overview and entry point." },
      { href: "/league/schools", label: "Schools", system: "world-economy", feature: "league", description: "Participating school directory." },
      { href: "/league/season", label: "Season", system: "world-economy", feature: "league", description: "Current League season and challenges." },
      { href: "/league/standings", label: "Standings", system: "world-economy", feature: "league", description: "Published League standings." },
      { href: "/league/about", label: "League about", system: "world-economy", feature: "league", description: "League rules and organisation." },
    ],
  },
  {
    id: "teams", label: "Teams", href: "/team", system: "shared",
    description: "The canonical organisation and team entry point.",
    children: [
      { href: "/team", label: "EconMind Team", system: "shared", description: "Network and leadership directory." },
      { href: "/league/teams", label: "Manage League teams", system: "world-economy", feature: "league", description: "Existing League team membership and management." },
    ],
  },
  {
    id: "community-legal", label: "Community & Legal", href: "/discussions", system: "shared",
    description: "Existing community spaces and governance information.",
    children: [
      { href: "/discussions", label: "Community", system: "shared", description: "Current discussion space." },
      { href: "/questions", label: "Questions", system: "shared", description: "Current inquiry archive." },
      { href: "/events", label: "Events", system: "shared", description: "Current community events." },
      { href: "/about", label: "About", system: "shared", description: "Current community and organisation information." },
      { href: "/community-guidelines", label: "Community Guidelines", system: "shared", description: "Participation and conduct expectations." },
      { href: "/integrity", label: "Integrity", system: "shared", description: "Academic integrity and platform standards." },
      { href: "/legal", label: "Legal", system: "shared", description: "Legal notices and rights information." },
      { href: "/privacy", label: "Privacy Notice", system: "shared", description: "How EconMind handles personal information." },
      { href: "/terms", label: "Terms of Use", system: "shared", description: "Terms governing the platform." },
    ],
  },
  {
    id: "workspace", label: "Workspace", href: "/dashboard", system: "shared",
    description: "Personal saved work, progress and account tools.",
    children: [
      { href: "/dashboard", label: "Dashboard", system: "shared", description: "Saved work, progress and recent activity." },
      { href: "/workspace", label: "Integrated Workspace", system: "shared", description: "Existing personal economics workspace." },
      { href: "/library", label: "Library", system: "shared", description: "Existing saved and learning library." },
      { href: "/profile", label: "Profile", system: "shared", description: "Existing profile settings and identity." },
    ],
  },
] as const;

export function isFeatureEnabled(feature: FeatureFlag | undefined) {
  return feature === undefined || FEATURE_FLAGS[feature];
}

export function availableNavigationSections() {
  return NAVIGATION_SECTIONS
    .filter((section) => isFeatureEnabled(section.feature))
    .map((section) => ({ ...section, children: section.children.filter((item) => isFeatureEnabled(item.feature)) }));
}

export function isNavigationSectionActive(section: Pick<NavigationSection, "href" | "children">, pathname: string) {
  if (pathname === section.href) return true;

  const matchesAChild = section.children.some((item) => pathname === item.href || (item.href !== section.href && pathname.startsWith(`${item.href}/`)));
  if (matchesAChild) return true;

  // A more specific child route wins over a broad section root. This keeps
  // `/league/teams` visibly in Teams rather than highlighting two top-level
  // destinations at once, while all other League routes still resolve there.
  const ownedByAnotherSection = NAVIGATION_SECTIONS.some((candidate) => candidate.href !== section.href && candidate.children.some((item) => pathname === item.href || pathname.startsWith(`${item.href}/`)));
  return !ownedByAnotherSection && pathname.startsWith(`${section.href}/`);
}

// Compatibility exports for existing consumers. They are derived from the
// canonical sections above rather than maintaining a second taxonomy.
export const PLATFORM_NAVIGATION: readonly PlatformNavigationItem[] = NAVIGATION_SECTIONS.flatMap((section) => [
  { href: section.href, label: section.label, system: section.system, feature: section.feature, description: section.description },
  ...section.children,
]);

export const PRIMARY_NAVIGATION: readonly PlatformNavigationItem[] = NAVIGATION_SECTIONS.map((section) => ({
  href: section.href, label: section.label, system: section.system, feature: section.feature, description: section.description,
}));

export const MOBILE_NAVIGATION_GROUPS = NAVIGATION_SECTIONS.map((section) => ({
  label: section.label, href: section.href, items: section.children,
})) as readonly { label: string; href: string; items: readonly PlatformNavigationItem[] }[];

export function availableNavigation() {
  return PLATFORM_NAVIGATION.filter((item) => isFeatureEnabled(item.feature));
}

export function availablePrimaryNavigation() {
  return PRIMARY_NAVIGATION.filter((item) => isFeatureEnabled(item.feature));
}
