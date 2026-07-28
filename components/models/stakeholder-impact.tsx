import { UsersRound } from "lucide-react";
import { ExpandableAnalysisPanel } from "@/components/models/expandable-analysis-panel";

export type StakeholderImpactItem = {
  stakeholder: string;
  direction: "Gains" | "Loses" | "Mixed" | "Depends";
  magnitude?: string;
  shortRun: string;
  longRun?: string;
  equity?: string;
  reason: string;
};

export function StakeholderImpact({ items, modelLabel }: { items: StakeholderImpactItem[]; modelLabel?: string }) {
  return <ExpandableAnalysisPanel title="Stakeholder impact" modelLabel={modelLabel} subtitle="Who is affected, why, and where the simplified model leaves uncertainty.">
    <div className="overflow-x-auto">
      <table className="min-w-[760px] w-full border-collapse text-left">
        <thead><tr className="border-b border-[var(--line)] text-[11px] uppercase tracking-wider text-[var(--ink-faint)]"><th className="p-3">Stakeholder</th><th className="p-3">Impact</th><th className="p-3">Short run</th><th className="p-3">Long run / equity</th><th className="p-3">Mechanism</th></tr></thead>
        <tbody>{items.map((item) => <tr key={item.stakeholder} className="border-b border-[var(--line)] align-top last:border-0"><td className="p-3 font-bold">{item.stakeholder}</td><td className="p-3"><span className={"rounded px-2 py-1 text-xs font-bold " + (item.direction === "Gains" ? "bg-[var(--accent-soft)] text-[var(--accent)]" : item.direction === "Loses" ? "bg-[var(--red-soft)] text-[var(--red)]" : "bg-[var(--surface-subtle)] text-[var(--ink-muted)]")}>{item.direction}</span>{item.magnitude && <p className="mt-2 text-xs text-[var(--ink-muted)]">{item.magnitude}</p>}</td><td className="p-3 text-sm leading-6 text-[var(--ink-muted)]">{item.shortRun}</td><td className="p-3 text-sm leading-6 text-[var(--ink-muted)]">{item.longRun ?? item.equity ?? "Not separately represented."}</td><td className="p-3 text-sm leading-6 text-[var(--ink-muted)]">{item.reason}</td></tr>)}</tbody>
      </table>
    </div>
  </ExpandableAnalysisPanel>;
}

export function StakeholderTitle() {
  return <span className="inline-flex items-center gap-2"><UsersRound size={16} />Stakeholders</span>;
}
