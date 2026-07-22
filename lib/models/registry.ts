export type ModelCategory = "Markets" | "Policy" | "Firms" | "Macro" | "Behavioral" | "Sandbox";
export type ModelDifficulty = "Beginner" | "Intermediate" | "Advanced";
export type ModelStatus = "available" | "coming-soon";
export type ModelIconKey =
  | "market"
  | "policy"
  | "controls"
  | "elasticity"
  | "externality"
  | "monopoly"
  | "ppf"
  | "macro"
  | "trade"
  | "behavioral"
  | "sandbox";

export type ModelDefinition = {
  slug: string;
  route: string;
  title: string;
  shortTitle: string;
  description: string;
  category: ModelCategory;
  difficulty: ModelDifficulty;
  estimatedMinutes: number;
  prerequisites: string[];
  relatedModels: string[];
  learningObjectives: string[];
  concepts: string[];
  status: ModelStatus;
  icon: ModelIconKey;
  number: string;
};

export const MODEL_REGISTRY = [
  {
    slug: "supply-demand",
    route: "/models/supply-demand",
    title: "Supply & Demand",
    shortTitle: "Market Equilibrium",
    description: "See how buyers and sellers jointly determine equilibrium price, quantity, and economic surplus.",
    category: "Markets",
    difficulty: "Beginner",
    estimatedMinutes: 12,
    prerequisites: [],
    relatedModels: ["elasticity", "policy", "price-controls"],
    learningObjectives: ["Find a competitive equilibrium", "Interpret market shifts", "Measure gains from trade"],
    concepts: ["Equilibrium", "Welfare", "Market shifts"],
    status: "available",
    icon: "market",
    number: "01",
  },
  {
    slug: "policy",
    route: "/models/policy",
    title: "Indirect Tax & Subsidy",
    shortTitle: "Policy Incidence",
    description: "Trace a policy wedge through buyer prices, seller prices, trade volume, public finance, and welfare.",
    category: "Policy",
    difficulty: "Intermediate",
    estimatedMinutes: 15,
    prerequisites: ["supply-demand"],
    relatedModels: ["elasticity", "externalities", "sandbox"],
    learningObjectives: ["Calculate tax incidence", "Compare taxes and subsidies", "Identify deadweight loss"],
    concepts: ["Tax incidence", "Subsidies", "Deadweight loss"],
    status: "available",
    icon: "policy",
    number: "02",
  },
  {
    slug: "price-controls",
    route: "/models/price-controls",
    title: "Price Controls",
    shortTitle: "Ceilings, Floors & Rationing",
    description: "Test when a price ceiling or floor becomes binding and measure shortages, surpluses, and welfare loss.",
    category: "Policy",
    difficulty: "Intermediate",
    estimatedMinutes: 14,
    prerequisites: ["supply-demand"],
    relatedModels: ["policy", "elasticity"],
    learningObjectives: ["Identify binding controls", "Calculate shortages and surpluses", "Explain rationing costs"],
    concepts: ["Price ceiling", "Price floor", "Shortage"],
    status: "available",
    icon: "controls",
    number: "03",
  },
  {
    slug: "elasticity",
    route: "/models/elasticity",
    title: "Elasticity & Revenue",
    shortTitle: "Price Sensitivity",
    description: "Move along a demand curve and discover how local price sensitivity governs total revenue.",
    category: "Markets",
    difficulty: "Beginner",
    estimatedMinutes: 12,
    prerequisites: ["supply-demand"],
    relatedModels: ["policy", "monopoly"],
    learningObjectives: ["Calculate point elasticity", "Classify demand response", "Connect elasticity to revenue"],
    concepts: ["Point elasticity", "Total revenue", "Pricing"],
    status: "available",
    icon: "elasticity",
    number: "04",
  },
  {
    slug: "externalities",
    route: "/models/externalities",
    title: "Externalities",
    shortTitle: "Private and Social Welfare",
    description: "Compare private incentives with social costs and benefits, then derive a corrective policy.",
    category: "Policy",
    difficulty: "Intermediate",
    estimatedMinutes: 18,
    prerequisites: ["supply-demand", "policy"],
    relatedModels: ["policy", "sandbox"],
    learningObjectives: ["Separate private and social curves", "Find the efficient quantity", "Calculate corrective policy"],
    concepts: ["Social cost", "Pigouvian policy", "Welfare"],
    status: "available",
    icon: "externality",
    number: "05",
  },
  {
    slug: "monopoly",
    route: "/models/monopoly",
    title: "Monopoly",
    shortTitle: "Market Power & Markup",
    description: "Compare profit-maximizing monopoly output with a competitive benchmark.",
    category: "Firms",
    difficulty: "Intermediate",
    estimatedMinutes: 18,
    prerequisites: ["elasticity"],
    relatedModels: ["elasticity", "price-controls"],
    learningObjectives: ["Use MR = MC", "Calculate profit", "Measure monopoly deadweight loss"],
    concepts: ["Marginal revenue", "Profit", "Market power"],
    status: "available",
    icon: "monopoly",
    number: "06",
  },
  {
    slug: "ppf",
    route: "/models/ppf",
    title: "Production Possibility Frontier",
    shortTitle: "Scarcity & Opportunity Cost",
    description: "Allocate productive capacity and distinguish efficient, inefficient, and unattainable outcomes.",
    category: "Markets",
    difficulty: "Beginner",
    estimatedMinutes: 14,
    prerequisites: [],
    relatedModels: ["comparative-advantage", "ad-as"],
    learningObjectives: ["Classify production points", "Calculate opportunity cost", "Explain economic growth"],
    concepts: ["Scarcity", "Efficiency", "Growth"],
    status: "available",
    icon: "ppf",
    number: "07",
  },
  {
    slug: "ad-as",
    route: "/models/ad-as",
    title: "Aggregate Demand & Supply",
    shortTitle: "Output, Prices & Gaps",
    description: "Explore simplified demand and supply shocks without presenting the result as a real forecast.",
    category: "Macro",
    difficulty: "Intermediate",
    estimatedMinutes: 18,
    prerequisites: ["supply-demand", "ppf"],
    relatedModels: ["ppf", "sandbox"],
    learningObjectives: ["Find short-run macro equilibrium", "Identify output gaps", "Distinguish demand and supply inflation"],
    concepts: ["AD", "SRAS", "Output gap"],
    status: "available",
    icon: "macro",
    number: "08",
  },
  {
    slug: "sandbox",
    route: "/sandbox",
    title: "Economic Sandbox",
    shortTitle: "Policy Mix Laboratory",
    description: "Combine simplified fiscal, monetary, market, environmental, and trade policy tools.",
    category: "Sandbox",
    difficulty: "Advanced",
    estimatedMinutes: 20,
    prerequisites: ["supply-demand", "policy"],
    relatedModels: ["policy", "externalities", "ad-as"],
    learningObjectives: ["Combine policy instruments", "Read multi-indicator trade-offs", "Compare scenarios transparently"],
    concepts: ["Policy mix", "Trade-offs", "Scenario analysis"],
    status: "available",
    icon: "sandbox",
    number: "09",
  },
  {
    slug: "comparative-advantage",
    route: "/models/comparative-advantage",
    title: "Comparative Advantage",
    shortTitle: "Specialization & Trade",
    description: "Compare opportunity costs and gains from specialization.",
    category: "Markets",
    difficulty: "Intermediate",
    estimatedMinutes: 16,
    prerequisites: ["ppf"],
    relatedModels: ["ppf", "sandbox"],
    learningObjectives: ["Compare opportunity costs", "Choose specialization", "Explain gains from trade"],
    concepts: ["Opportunity cost", "Trade", "Specialization"],
    status: "coming-soon",
    icon: "trade",
    number: "10",
  },
  {
    slug: "behavioral-biases",
    route: "/models/behavioral-biases",
    title: "Behavioral Biases",
    shortTitle: "Choice Under Friction",
    description: "Explore how framing and reference points can influence simplified choices.",
    category: "Behavioral",
    difficulty: "Beginner",
    estimatedMinutes: 12,
    prerequisites: [],
    relatedModels: ["elasticity"],
    learningObjectives: ["Recognize framing", "Explain reference dependence", "Separate description from prediction"],
    concepts: ["Framing", "Reference points", "Choice"],
    status: "coming-soon",
    icon: "behavioral",
    number: "11",
  },
] as const satisfies readonly ModelDefinition[];

export type ModelSlug = (typeof MODEL_REGISTRY)[number]["slug"];

export const AVAILABLE_MODELS = MODEL_REGISTRY.filter((model) => model.status === "available");
export const getModel = (slug: string) => MODEL_REGISTRY.find((model) => model.slug === slug);
export const getAvailableModel = (slug: string) => AVAILABLE_MODELS.find((model) => model.slug === slug);
export const getModelsByCategory = (category: ModelCategory) => MODEL_REGISTRY.filter((model) => model.category === category);
