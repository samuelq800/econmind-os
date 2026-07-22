import { getModel, type ModelDefinition, type ModelSlug } from "@/lib/models/registry";

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
  policy: [
    { slug: "externalities", reason: "Extend corrective policy to social costs and benefits." },
    { slug: "sandbox", reason: "Combine fiscal policy with other simplified instruments." },
  ],
  ppf: [
    { slug: "comparative-advantage", reason: "Use opportunity cost to analyze specialization." },
  ],
  externalities: [
    { slug: "sandbox", reason: "Build a carbon-policy mix from the externality framework.", preset: "Green Transition" },
  ],
};

export function recommendNext(completedSlugs: string[], limit = 3): Recommendation[] {
  const completed = new Set(completedSlugs);
  const candidates = completedSlugs.flatMap((slug) => rules[slug as ModelSlug] ?? []);
  if (candidates.length === 0) {
    candidates.push({ slug: "supply-demand", reason: "Begin with the core mechanism behind market equilibrium." });
  }

  const seen = new Set<string>();
  return candidates
    .filter((candidate) => !completed.has(candidate.slug) && !seen.has(candidate.slug) && Boolean(getModel(candidate.slug)) && seen.add(candidate.slug))
    .slice(0, limit)
    .map((candidate) => ({ model: getModel(candidate.slug)!, reason: candidate.reason, preset: candidate.preset }));
}
