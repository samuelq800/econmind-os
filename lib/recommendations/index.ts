import { AVAILABLE_MODELS, getAvailableModel, type ModelDefinition, type ModelSlug } from "@/lib/models/registry";

export type Recommendation = {
  model: ModelDefinition;
  reason: string;
  preset?: string;
};

const rules: Partial<Record<ModelSlug, Array<{ slug: ModelSlug; reason: string; preset?: string }>>> = {
  "supply-demand": [
    { slug: "policy", reason: "Apply equilibrium analysis to taxes and subsidies." },
    { slug: "price-controls", reason: "Test how binding ceilings and floors change trade." },
    { slug: "elasticity", reason: "Study how responsiveness changes market outcomes." },
  ],
  elasticity: [
    { slug: "policy", reason: "Use elasticity to interpret policy incidence." },
    { slug: "monopoly", reason: "Connect demand responsiveness to market power." },
  ],
  "price-controls": [
    { slug: "externalities", reason: "Compare regulation with a corrective social-welfare policy." },
    { slug: "monopoly", reason: "See how market power creates a different price and quantity wedge." },
  ],
  policy: [
    { slug: "externalities", reason: "Extend corrective policy to social costs and benefits." },
    { slug: "sandbox", reason: "Combine fiscal policy with other simplified instruments." },
  ],
  ppf: [
    { slug: "ad-as", reason: "Connect productive capacity to potential output and macroeconomic gaps." },
    { slug: "comparative-advantage", reason: "Use opportunity cost to analyze specialization." },
  ],
  externalities: [
    { slug: "sandbox", reason: "Build a carbon-policy mix from the externality framework.", preset: "Green Transition" },
    { slug: "ad-as", reason: "Study how broader demand and supply shocks change output and prices." },
  ],
  monopoly: [
    { slug: "ppf", reason: "Step back from firm pricing to economy-wide scarcity and allocation." },
  ],
  "ad-as": [
    { slug: "sandbox", reason: "Combine multiple policy instruments and compare wider trade-offs." },
  ],
};

export function recommendNext(completedSlugs: string[], limit = 3): Recommendation[] {
  const completed = new Set(completedSlugs);
  const candidates = completedSlugs.flatMap((slug) => rules[slug as ModelSlug] ?? []);
  if (candidates.length === 0) {
    candidates.push({ slug: "supply-demand", reason: "Begin with the core mechanism behind market equilibrium." });
  }

  const seen = new Set<string>();
  const resolved = candidates
    .filter((candidate) => !completed.has(candidate.slug) && !seen.has(candidate.slug) && Boolean(getAvailableModel(candidate.slug)) && seen.add(candidate.slug))
    .slice(0, limit)
    .map((candidate) => ({ model: getAvailableModel(candidate.slug)!, reason: candidate.reason, preset: candidate.preset }));

  if (resolved.length > 0) return resolved;
  return AVAILABLE_MODELS
    .filter((model) => !completed.has(model.slug))
    .slice(0, limit)
    .map((model) => ({ model, reason: "Continue with another available mechanism in the model library." }));
}
