export const FEATURE_FLAGS = {
  dailyBrief: true,
  sandbox: true,
  modelWorkspace: true,
  modelPractice: false,
  modelComposer: false,
  modelCompare: false,
  modelValidation: false,
  econBench: false,
  mechanismArena: false,
  evidenceLab: false,
  evidenceUpload: false,
  worldEconomy: false,
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
  { href: "/world", label: "World Economy", system: "world-economy", feature: "worldEconomy" },
  { href: "/league", label: "League", system: "world-economy", feature: "league" },
  { href: "/research", label: "Research", system: "learning-research", feature: "evidenceLab" },
];

export function isFeatureEnabled(feature: FeatureFlag | undefined) {
  return feature === undefined || FEATURE_FLAGS[feature];
}

export function availableNavigation() {
  return PLATFORM_NAVIGATION.filter((item) => isFeatureEnabled(item.feature));
}
