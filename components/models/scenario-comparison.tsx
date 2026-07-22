"use client";

import { useState } from "react";
import { BookmarkPlus, CheckCircle2, CloudUpload, GitCompareArrows, LoaderCircle } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { safePercentChange, type ScenarioSnapshot } from "@/lib/economics/types";
import { usePersistentState } from "@/lib/hooks/use-persistent-state";
import { recordSavedProgress, saveModelRun, type ModelKey } from "@/lib/supabase/data";

const pretty = (key: string) => key.replace(/([A-Z])/g, " $1").replace(/^./, (character) => character.toUpperCase());
const format = (value: number) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);

export function ScenarioComparison({
  storageKey,
  modelKey,
  parameters,
  results,
  metrics,
}: {
  storageKey: string;
  modelKey: ModelKey;
  parameters: Record<string, number>;
  results: Record<string, number>;
  metrics: string[];
}) {
  const { user, openAuth } = useAuth();
  const [scenarios, setScenarios] = usePersistentState<{ A: ScenarioSnapshot | null; B: ScenarioSnapshot | null }>(storageKey, { A: null, B: null });
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");

  const saveLocal = (label: "A" | "B") =>
    setScenarios((current) => ({
      ...current,
      [label]: { label, parameters, results, savedAt: new Date().toISOString() },
    }));

  async function saveCloud() {
    if (!user) {
      openAuth("sign-in");
      return;
    }
    if (!name.trim()) {
      setError("Give this run a short name first.");
      return;
    }
    setBusy(true);
    setError("");
    setSaved("");
    try {
      await saveModelRun({ userId: user.id, modelKey, name: name.trim(), parameters, results });
      await recordSavedProgress(user.id, modelKey, parameters);
      setSaved(name.trim());
      setName("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save this run.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5 sm:p-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.12em]"><GitCompareArrows size={16} /><h2>Scenario comparison</h2></div>
          <p className="mt-1 text-[11px] text-[var(--ink-muted)]">A/B snapshots stay in this browser. Signed-in users can also save named runs privately to Supabase.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => saveLocal("A")}><BookmarkPlus size={14} />Save A</Button>
          <Button variant="secondary" size="sm" onClick={() => saveLocal("B")}><BookmarkPlus size={14} />Save B</Button>
        </div>
      </div>

      <div className="mt-5 overflow-hidden rounded-lg border border-[var(--line)]">
        <div className="grid grid-cols-[1.3fr_1fr_1fr_1fr] bg-[var(--surface-subtle)] px-3 py-2 text-[9px] font-bold uppercase tracking-wider text-[var(--ink-faint)]">
          <span>Metric</span><span className="text-right">Scenario A</span><span className="text-right">Scenario B</span><span className="text-right">Change</span>
        </div>
        {metrics.map((metric) => {
          const a = scenarios.A?.results[metric];
          const b = scenarios.B?.results[metric];
          const change = a !== undefined && b !== undefined ? safePercentChange(a, b) : null;
          return (
            <div key={metric} className="grid grid-cols-[1.3fr_1fr_1fr_1fr] border-t border-[var(--line)] px-3 py-3 text-[11px]">
              <span className="truncate font-semibold">{pretty(metric)}</span>
              <span className="text-right text-[var(--ink-muted)]">{a === undefined ? "—" : format(a)}</span>
              <span className="text-right text-[var(--ink-muted)]">{b === undefined ? "—" : format(b)}</span>
              <span className={`text-right font-semibold ${change === null ? "text-[var(--ink-faint)]" : change > 0 ? "text-[var(--accent)]" : change < 0 ? "text-[var(--red)]" : "text-[var(--ink-muted)]"}`}>
                {change === null ? "—" : `${change > 0 ? "+" : ""}${format(change)}%`}
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-5 rounded-xl border border-[var(--line)] bg-[var(--canvas)] p-4">
        <div className="flex items-center gap-2 text-xs font-bold"><CloudUpload size={15} className="text-[var(--accent)]" />Save a named cloud run</div>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            value={name}
            onChange={(event) => { setName(event.target.value); setError(""); setSaved(""); }}
            maxLength={120}
            placeholder={user ? "e.g. High-demand subsidy" : "Sign in to save privately"}
            disabled={!user || busy}
            className="h-10 min-w-0 flex-1 rounded-lg border border-[var(--line-strong)] bg-[var(--surface)] px-3 text-sm outline-none focus:border-[var(--accent)] disabled:opacity-60"
          />
          <Button onClick={() => void saveCloud()} disabled={busy}>
            {busy ? <LoaderCircle className="animate-spin" size={15} /> : <CloudUpload size={15} />}
            {user ? "Save to cloud" : "Sign in"}
          </Button>
        </div>
        {error && <p role="alert" className="mt-2 text-[11px] text-[var(--red)]">{error}</p>}
        {saved && <p className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-[var(--accent)]"><CheckCircle2 size={13} />“{saved}” is now in My Library.</p>}
      </div>
    </section>
  );
}
