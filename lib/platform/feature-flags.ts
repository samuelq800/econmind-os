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
};

// Keep the eventual information architecture in one typed place. Features that
// are not ready stay out of normal navigation instead of exposing empty pages.
export const PLATFORM_NAVIGATION: readonly PlatformNavigationItem[] = [
  { href: "/", label: "Home", system: "shared" },
  { href: "/explore", label: "Explore", system: "learning-research", feature: "dailyBrief" },
  { href: "/models", label: "Models", system: "learning-research", feature: "modelWorkspace" },
  { href: "/sandbox", label: "Sandbox", system: "learning-research", feature: "sandbox" },
  { href: "/econbench", label: "EconBench", system: "learning-research", feature: "econBench" },
  { href: "/mechanism-arena", label: "Mechanism Arena", system: "learning-research", feature: "mechanismArena" },
  { href: "/league", label: "League", system: "world-economy", feature: "league" },
  { href: "/research", label: "Evidence Lab", system: "learning-research", feature: "evidenceLab" },
];

export function isFeatureEnabled(feature: FeatureFlag | undefined) {
  return feature === undefined || FEATURE_FLAGS[feature];
}

export function availableNavigation() {
  return PLATFORM_NAVIGATION.filter((item) => isFeatureEnabled(item.feature));
}
