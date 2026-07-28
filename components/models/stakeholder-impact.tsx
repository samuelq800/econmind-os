import { UsersRound } from "lucide-react";
import { ExpandableAnalysisPanel } from "@/components/models/expandable-analysis-panel";

export type StakeholderImpactStatus = "improves" | "worsens" | "mixed" | "unchanged" | "indeterminate";
export type StakeholderMetric = { metric: string; previousValue?: number; currentValue?: number; change?: number; unit?: string };
export type StakeholderImpactResult = {
  stakeholder: string;
  status: StakeholderImpactStatus;
  comparisonBaseline: string;
  affectedMetrics: StakeholderMetric[];
  mechanism: string;
  shortRunEffect?: string;
  longRunEffect?: string;
  equityConcern?: string;
  uncertainty?: string;
};

/** Kept only so existing model definitions render while they move to baseline-aware results. */
export type StakeholderImpactItem = {
  stakeholder: string;
  direction?: "Gains" | "Loses" | "Mixed" | "Depends";
  status?: StakeholderImpactStatus;
  comparisonBaseline?: string;
  affectedMetrics?: StakeholderMetric[];
  magnitude?: string;
  shortRun?: string;
  shortRunEffect?: string;
  longRun?: string;
  longRunEffect?: string;
  equity?: string;
  equityConcern?: string;
  uncertainty?: string;
  reason?: string;
  mechanism?: string;
};

const labels: Record<StakeholderImpactStatus, string> = { improves: "Improves", worsens: "Worsens", mixed: "Mixed", unchanged: "Unchanged", indeterminate: "Indeterminate" };
const tones: Record<StakeholderImpactStatus, string> = { improves: "bg-[var(--accent-soft)] text-[var(--accent)]", worsens: "bg-[var(--red-soft)] text-[var(--red)]", mixed: "bg-[var(--amber-soft)] text-[var(--amber)]", unchanged: "bg-[var(--surface-subtle)] text-[var(--ink-muted)]", indeterminate: "bg-[var(--surface-subtle)] text-[var(--ink-muted)]" };

function legacyStatus(direction?: StakeholderImpactItem["direction"]): StakeholderImpactStatus {
  // Older model cards did not carry a numerical baseline. Preserve genuinely
  // heterogeneous effects, but withhold a gain/loss conclusion until a
  // baseline-aware result is supplied.
  return direction === "Mixed" ? "mixed" : "indeterminate";
}

function normalize(item: StakeholderImpactItem): StakeholderImpactResult {
  return {
    stakeholder: item.stakeholder,
    status: item.status ?? legacyStatus(item.direction),
    comparisonBaseline: item.comparisonBaseline ?? "No live comparison baseline supplied (classification withheld)",
    affectedMetrics: item.affectedMetrics ?? (item.magnitude ? [{ metric: item.magnitude }] : []),
    mechanism: item.mechanism ?? item.reason ?? "The simplified model does not contain enough information for a fuller welfare inference.",
    shortRunEffect: item.shortRunEffect ?? item.shortRun,
    longRunEffect: item.longRunEffect ?? item.longRun,
    equityConcern: item.equityConcern ?? item.equity,
    uncertainty: item.uncertainty,
  };
}

export function StakeholderImpact({ items, modelLabel }: { items: StakeholderImpactItem[]; modelLabel?: string }) {
  const normalized = items.map(normalize);
  return <ExpandableAnalysisPanel title="Stakeholder impact" modelLabel={modelLabel} subtitle="Effects are assessed against the stated baseline; numerical direction alone is not a welfare judgement.">
    <div className="overflow-x-auto">
      <table className="min-w-[900px] w-full border-collapse text-left"><thead><tr className="border-b border-[var(--line)] text-[11px] uppercase tracking-wider text-[var(--ink-faint)]"><th className="p-3">Stakeholder</th><th className="p-3">Relative effect</th><th className="p-3">Comparison baseline</th><th className="p-3">Affected metric</th><th className="p-3">Mechanism / uncertainty</th></tr></thead>
        <tbody>{normalized.map((item) => <tr key={item.stakeholder} className="border-b border-[var(--line)] align-top last:border-0"><td className="p-3 font-bold">{item.stakeholder}</td><td className="p-3"><span className={`rounded px-2 py-1 text-xs font-bold ${tones[item.status]}`}>{labels[item.status]}</span>{item.shortRunEffect && <p className="mt-2 text-xs leading-5 text-[var(--ink-muted)]">{item.shortRunEffect}</p>}</td><td className="p-3 text-sm leading-6 text-[var(--ink-muted)]">{item.comparisonBaseline}</td><td className="p-3 text-sm leading-6 text-[var(--ink-muted)]">{item.affectedMetrics.length ? item.affectedMetrics.map((metric) => <p key={metric.metric}>{metric.metric}{metric.previousValue !== undefined && metric.currentValue !== undefined ? `: ${metric.previousValue} → ${metric.currentValue}${metric.change !== undefined ? ` (${metric.change > 0 ? "+" : ""}${metric.change})` : ""}${metric.unit ?? ""}` : ""}</p>) : "Not separately quantified."}</td><td className="p-3 text-sm leading-6 text-[var(--ink-muted)]"><p>{item.mechanism}</p>{item.longRunEffect && <p className="mt-2"><strong>Long run:</strong> {item.longRunEffect}</p>}{item.equityConcern && <p className="mt-2"><strong>Equity:</strong> {item.equityConcern}</p>}{item.uncertainty && <p className="mt-2"><strong>Uncertainty:</strong> {item.uncertainty}</p>}</td></tr>)}</tbody>
      </table>
    </div>
  </ExpandableAnalysisPanel>;
}

export function StakeholderTitle() { return <span className="inline-flex items-center gap-2"><UsersRound size={16} />Stakeholders</span>; }
