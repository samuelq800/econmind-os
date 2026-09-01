export type SimulationNavigationIcon =
  | "home"
  | "world"
  | "challenge"
  | "command"
  | "competition"
  | "arena"
  | "history"
  | "scenario"
  | "battle"
  | "dashboard";

export type SimulationNavigationItem = {
  href: string;
  label: string;
  description: string;
  icon: SimulationNavigationIcon;
  match: (pathname: string) => boolean;
};

/** Canonical secondary destinations for the protected Simulation product. */
export const SIMULATION_NAVIGATION_ITEMS = [
  {
    href: "/simulation",
    label: "Simulation Home",
    description: "Open the protected economic simulation hub.",
    icon: "home",
    match: (path) => path === "/simulation" || path === "/simulation/",
  },
  {
    href: "/simulation/world",
    label: "12-Country World",
    description: "Enter the twelve-country world economy.",
    icon: "world",
    match: (path) => path.startsWith("/simulation/world"),
  },
  {
    href: "/simulation/quick-challenge",
    label: "Quick Challenge",
    description: "Make rapid decisions in a compact economic scenario.",
    icon: "challenge",
    match: (path) =>
      path.startsWith("/simulation/quick-challenge") ||
      path.startsWith("/simulation/crisis-sprint"),
  },
  {
    href: "/simulation/command-centre",
    label: "Command Centre",
    description: "Run structured policy rounds and compare outcomes.",
    icon: "command",
    match: (path) => path.startsWith("/simulation/command-centre"),
  },
  {
    href: "/simulation/legacy-world",
    label: "World Competition",
    description: "Open the established world competition experience.",
    icon: "competition",
    match: (path) => path.startsWith("/simulation/legacy-world"),
  },
  {
    href: "/simulation/arena",
    label: "Simulation Arena",
    description: "Browse applied simulation scenarios.",
    icon: "arena",
    match: (path) => path.startsWith("/simulation/arena"),
  },
  {
    href: "/simulation/arena/time-machine-1973-oil-shock",
    label: "1973 Oil Shock",
    description: "Explore the 1973 oil shock time-machine scenario.",
    icon: "history",
    match: (path) =>
      path.startsWith("/simulation/arena/time-machine-1973-oil-shock"),
  },
  {
    href: "/simulation/scenario-studio",
    label: "Scenario Studio",
    description: "Create and manage economic simulation scenarios.",
    icon: "scenario",
    match: (path) => path.startsWith("/simulation/scenario-studio"),
  },
  {
    href: "/simulation/model-battle",
    label: "Model Battle",
    description: "Compare competing economic explanations.",
    icon: "battle",
    match: (path) => path.startsWith("/simulation/model-battle"),
  },
  {
    href: "/simulation/dashboard",
    label: "Dashboard",
    description: "Open the Simulation workspace dashboard.",
    icon: "dashboard",
    match: (path) => path.startsWith("/simulation/dashboard"),
  },
] as const satisfies readonly SimulationNavigationItem[];
