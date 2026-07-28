import { ListChecks } from "lucide-react";
import type { AssumptionSections } from "@/lib/models/assumptions";
import { ExpandableAnalysisPanel } from "@/components/models/expandable-analysis-panel";
import { MODEL_ASSUMPTIONS } from "@/lib/models/assumptions";
import { StakeholderImpact, type StakeholderImpactItem } from "@/components/models/stakeholder-impact";
import { ShortRunLongRun } from "@/components/models/short-run-long-run";

const sections: Array<{ key: keyof AssumptionSections; label: string }> = [
  { key: "structural", label: "Structural assumptions" },
  { key: "parameters", label: "Parameter assumptions" },
  { key: "limitations", label: "What the model cannot conclude" },
];

const stakeholderPanels: Partial<Record<keyof typeof MODEL_ASSUMPTIONS, StakeholderImpactItem[]>> = {
  "supply-demand": [{ stakeholder: "Consumers", direction: "Depends", shortRun: "Benefit from lower prices and lose from higher prices.", reason: "Demand determines willingness to buy at each price." }, { stakeholder: "Producers", direction: "Depends", shortRun: "Benefit from higher prices and lose from lower prices.", reason: "Supply determines willingness to sell at each price." }, { stakeholder: "Market surplus", direction: "Mixed", shortRun: "Gains from trade depend on equilibrium quantity.", reason: "The model adds consumer and producer surplus." }],
  policy: [{ stakeholder: "Consumers", direction: "Depends", shortRun: "Tax burden or subsidy benefit follows buyer-price change.", reason: "Incidence depends on relative responsiveness." }, { stakeholder: "Producers", direction: "Depends", shortRun: "Tax burden or subsidy benefit follows seller-price change.", reason: "Incidence depends on relative responsiveness." }, { stakeholder: "Government", direction: "Mixed", shortRun: "Taxes collect revenue; subsidies use public funds.", reason: "The wedge times quantity is calculated directly." }],
  "price-controls": [{ stakeholder: "Consumers", direction: "Mixed", shortRun: "A low ceiling can lower price but create rationing.", reason: "Quantity traded is limited by the short side." }, { stakeholder: "Producers", direction: "Mixed", shortRun: "A binding floor can raise price but create unsold output.", reason: "Legal price changes incentives." }, { stakeholder: "Low-income households", direction: "Depends", shortRun: "Access depends on allocation, not price alone.", reason: "Queues and black markets are excluded." }],
  elasticity: [{ stakeholder: "Consumers", direction: "Depends", shortRun: "Quantity response depends on selected price and elasticity.", reason: "The model describes one demand curve." }, { stakeholder: "Firm", direction: "Mixed", shortRun: "Revenue rises or falls depending on local elasticity.", reason: "Revenue equals price times quantity." }],
  externalities: [{ stakeholder: "Consumers", direction: "Mixed", shortRun: "Corrective policy can change prices and quantity.", reason: "Private and social margins differ." }, { stakeholder: "Producers", direction: "Mixed", shortRun: "Tax or subsidy changes the producer-side incentive.", reason: "The policy equals the per-unit spillover." }, { stakeholder: "Future society", direction: "Gains", shortRun: "Benefits when output moves toward the social optimum.", reason: "The model values the avoided external impact." }],
  monopoly: [{ stakeholder: "Consumers", direction: "Loses", shortRun: "A monopoly restricts output relative to the competitive benchmark.", reason: "Price is read from demand after MR = MC." }, { stakeholder: "Firm", direction: "Gains", shortRun: "Can earn a markup and profit in the model.", reason: "The firm has market power." }, { stakeholder: "Society", direction: "Loses", shortRun: "Some gains from trade are lost.", reason: "Deadweight loss is calculated against competition." }],
  "ad-as": [{ stakeholder: "Workers", direction: "Depends", shortRun: "Employment moves inversely with the simplified unemployment gap.", reason: "Output differs from potential." }, { stakeholder: "Households", direction: "Mixed", shortRun: "Output and price pressure can move in different directions.", reason: "AD and SRAS jointly shift the equilibrium." }, { stakeholder: "Firms", direction: "Depends", shortRun: "Sales and costs respond to demand and supply conditions.", reason: "The chart uses stylised aggregate curves." }],
};

const longRunPanels: Partial<Record<keyof typeof MODEL_ASSUMPTIONS, { shortRun: string; longRun: string }>> = {
  "price-controls": { shortRun: "A binding legal price creates a quantity shortage or surplus immediately in the simplified market.", longRun: "Entry, quality changes, investment, queues, black markets, and enforcement can alter outcomes; these are stylised educational mechanisms and are not calculated." },
  externalities: { shortRun: "A corrective tax or subsidy moves private incentives toward the efficient quantity.", longRun: "Technology, innovation, abatement, and behavioural responses can change the external cost; they are not estimated by this static model." },
  "ad-as": { shortRun: "AD and SRAS determine output and the price index around a fixed potential-output benchmark.", longRun: "Potential output, expectations, wages, and policy lags can adjust; this is a stylised educational mechanism, not a forecast." },
};

export function ModelAssumptions({ assumptions, modelLabel }: { assumptions: AssumptionSections; modelLabel?: string }) {
  const inferredKey = (Object.keys(MODEL_ASSUMPTIONS) as Array<keyof typeof MODEL_ASSUMPTIONS>).find((key) => MODEL_ASSUMPTIONS[key] === assumptions);
  return <><ExpandableAnalysisPanel title="Model assumptions" modelLabel={modelLabel} subtitle="Interpret the outputs only within these simplifying conditions.">
    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.12em] text-[var(--accent)]"><ListChecks size={16} /><span>Scope and limitations</span></div>
    <div className="mt-4 grid gap-3 lg:grid-cols-3">{sections.map((section) => <section key={section.key} className="rounded-lg bg-[var(--surface-subtle)] p-4"><h3 className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--ink-faint)]">{section.label}</h3><ul className="mt-3 space-y-2.5">{assumptions[section.key].map((assumption) => <li key={assumption} className="flex gap-2.5 text-sm leading-6 text-[var(--ink-muted)]"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-[var(--accent)]" /><span>{assumption}</span></li>)}</ul></section>)}</div>
  </ExpandableAnalysisPanel>
  {inferredKey && stakeholderPanels[inferredKey] && <div className="mt-5"><StakeholderImpact items={stakeholderPanels[inferredKey]} modelLabel={modelLabel} /></div>}
  {inferredKey && longRunPanels[inferredKey] && <div className="mt-5"><ShortRunLongRun {...longRunPanels[inferredKey]} modelLabel={modelLabel} /></div>}
  </>;
}
