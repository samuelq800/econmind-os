"use client";

import { useState } from "react";
import { TimerReset } from "lucide-react";
import { ExpandableAnalysisPanel } from "@/components/models/expandable-analysis-panel";

export function ShortRunLongRun({ shortRun, longRun, modelLabel }: { shortRun: string; longRun: string; modelLabel?: string }) {
  const [view, setView] = useState<"short" | "long">("short");
  return <ExpandableAnalysisPanel title="Short run / long run" modelLabel={modelLabel} subtitle="Long-run statements are stylised educational mechanisms, not forecasts.">
    <div className="flex gap-2 border-b border-[var(--line)] pb-4"><button type="button" onClick={() => setView("short")} className={"rounded-md px-3 py-2 text-sm font-bold " + (view === "short" ? "bg-[var(--accent)] text-white" : "bg-[var(--surface-subtle)]")}>Short run</button><button type="button" onClick={() => setView("long")} className={"rounded-md px-3 py-2 text-sm font-bold " + (view === "long" ? "bg-[var(--accent)] text-white" : "bg-[var(--surface-subtle)]")}>Long run</button></div>
    <div className="mt-5 flex gap-3 text-base leading-7 text-[var(--ink-muted)]"><TimerReset className="mt-1 shrink-0 text-[var(--accent)]" size={18} /><p>{view === "short" ? shortRun : longRun}</p></div>
  </ExpandableAnalysisPanel>;
}
