import { BookOpenCheck } from "lucide-react";
import { ExpandableAnalysisPanel } from "@/components/models/expandable-analysis-panel";

export function EconomicExplanation({ children, principle, modelLabel }: { children: React.ReactNode; principle?: string; modelLabel?: string }) {
  return <ExpandableAnalysisPanel title="Economic interpretation" modelLabel={modelLabel}>
    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.12em] text-[var(--accent)]"><BookOpenCheck size={16} /><span>Live reading</span></div>
    <p className="mt-4 max-w-4xl text-base leading-7 text-[var(--ink-muted)]">{children}</p>
    {principle && <div className="mt-5 border-l-2 border-[var(--accent)] pl-4 text-sm font-medium leading-6">Core principle: {principle}</div>}
  </ExpandableAnalysisPanel>;
}
