"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowDownRight, ArrowRight, ArrowUpRight, CheckCircle2, CloudUpload, FlaskConical, LoaderCircle, RotateCcw, TriangleAlert } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { FavoriteModelButton } from "@/components/models/favorite-model-button";
import { ParameterControl } from "@/components/models/parameter-control";
import { Button } from "@/components/ui/button";
import { BASELINE_INDICATORS, BASELINE_PARAMETERS, POLICY_DEFINITIONS } from "@/lib/economics/sandbox/defaults";
import { interpretSandbox } from "@/lib/economics/sandbox/interpretation";
import { SANDBOX_PRESETS } from "@/lib/economics/sandbox/presets";
import { sanitizeParameters, simulateSandbox } from "@/lib/economics/sandbox/simulation";
import type { IndicatorKey, PolicyCategory, SandboxParameters, SandboxResult } from "@/lib/economics/sandbox/types";
import type { ModelParameter } from "@/lib/economics/types";
import { usePersistentState } from "@/lib/hooks/use-persistent-state";
import { getModelRun, saveModelRun } from "@/lib/supabase/data";

const categories: PolicyCategory[] = ["Fiscal Policy", "Monetary Policy", "Market Regulation", "Environmental Policy", "Trade Policy"];
const indicatorLabels: Record<IndicatorKey, string> = {
  gdpIndex: "GDP Index",
  inflationRate: "Inflation Rate",
  unemploymentRate: "Unemployment Rate",
  governmentRevenue: "Government Revenue",
  consumerWelfare: "Consumer Welfare",
  firmProfit: "Firm Profit",
  carbonEmissions: "Carbon Emissions",
  marketOutput: "Market Output",
};
const percentIndicators = new Set<IndicatorKey>(["inflationRate", "unemploymentRate"]);
const format = (value: number) => new Intl.NumberFormat("en", { maximumFractionDigits: 2 }).format(value);

export default function SandboxPage() {
  const { user, openAuth } = useAuth();
  const [draft, setDraft] = usePersistentState<SandboxParameters>("econmind:sandbox:draft", BASELINE_PARAMETERS);
  const [scenarioName, setScenarioName] = useState("");
  const [activePreset, setActivePreset] = useState("custom");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const result = useMemo(() => simulateSandbox(draft), [draft]);
  const interpretation = useMemo(() => interpretSandbox(result), [result]);

  useEffect(() => {
    if (!user) return;
    const runId = new URLSearchParams(window.location.search).get("run");
    if (!runId) return;
    let active = true;
    void getModelRun(user.id, runId)
      .then((run) => {
        if (!active || !run || run.model_key !== "sandbox") return;
        const parameters = sanitizeParameters(run.parameters as Partial<SandboxParameters>);
        setDraft(parameters);
        setScenarioName(run.name);
        setMessage(`Loaded “${run.name}”. Results updated live.`);
      })
      .catch((caught) => { if (active) setError(caught instanceof Error ? caught.message : "Could not load the scenario."); });
    return () => { active = false; };
  }, [user, setDraft]);

  const radarData = [
    ["Growth", 100, result.radar.growth],
    ["Employment", 100, result.radar.employment],
    ["Price stability", 100, result.radar.priceStability],
    ["Consumer welfare", 100, result.radar.consumerWelfare],
    ["Firm profit", 100, result.radar.firmProfit],
    ["Environment", 100, result.radar.environmentalPerformance],
  ].map(([dimension, baseline, current]) => ({ dimension, baseline, current }));

  const impactData = [...result.contributions]
    .sort((a, b) => Object.values(b.values).reduce((sum, value) => sum + Math.abs(value ?? 0), 0) - Object.values(a.values).reduce((sum, value) => sum + Math.abs(value ?? 0), 0))
    .slice(0, 7)
    .map((item) => ({ policy: `${item.kind === "interaction" ? "↔ " : ""}${item.label}`, GDP: item.values.gdpIndex ?? 0, Revenue: item.values.governmentRevenue ?? 0, Emissions: item.values.carbonEmissions ?? 0 }));

  function update(key: keyof SandboxParameters, value: number) {
    setDraft((current) => sanitizeParameters({ ...current, [key]: value }));
    setActivePreset("custom");
    setMessage("");
  }

  function loadPreset(id: string) {
    const preset = SANDBOX_PRESETS.find((item) => item.id === id);
    if (!preset) return;
    setDraft({ ...preset.parameters });
    setActivePreset(id);
    setMessage(`${preset.name} loaded. Results updated live.`);
  }

  async function saveScenario() {
    if (!user) {
      openAuth("sign-in");
      return;
    }
    if (!scenarioName.trim()) {
      setError("Give the scenario a name before saving.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await saveModelRun({
        userId: user.id,
        modelKey: "sandbox",
        name: scenarioName.trim(),
        parameters: result.parameters,
        results: result.indicators,
        metadata: { scenario_type: activePreset, interpretation_summary: interpretation.summary },
      });
      setMessage(`“${scenarioName.trim()}” was saved to your workspace.`);
      setScenarioName("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save the scenario.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen">
      <header className="border-b border-[var(--line)] bg-[var(--surface)] px-5 py-8 sm:px-8 lg:px-10">
        <div className="mx-auto flex max-w-[1500px] flex-col justify-between gap-5 sm:flex-row sm:items-start">
          <div className="max-w-3xl">
            <p className="text-[10px] font-extrabold uppercase tracking-[.18em] text-[var(--accent)]">Policy mix laboratory</p>
            <h1 className="mt-3 text-4xl font-bold tracking-[-.05em] sm:text-5xl">Economic Sandbox</h1>
            <p className="mt-3 text-sm leading-6 text-[var(--ink-muted)] sm:text-base">Combine policy tools and observe how simplified economic indicators respond.</p>
            <p className="mt-4 rounded-lg border border-[var(--amber)] bg-[var(--amber-soft)] p-3 text-xs leading-5 text-[var(--amber)]"><TriangleAlert className="mr-2 inline" size={14} />This sandbox uses simplified economic relationships for educational simulation. It should not be interpreted as a real-world forecast.</p>
          </div>
          <FavoriteModelButton modelKey="sandbox" />
        </div>
      </header>

      <div className="mx-auto grid max-w-[1600px] gap-5 p-4 sm:p-6 xl:grid-cols-[320px_minmax(0,1fr)_340px] xl:items-start">
        <aside className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4 xl:sticky xl:top-20 xl:max-h-[calc(100vh-6rem)] xl:overflow-y-auto">
          <div className="flex items-center justify-between border-b border-[var(--line)] pb-3"><div><h2 className="text-sm font-bold">Policy controls</h2><p className="text-[10px] text-[var(--ink-muted)]">Every change calculates instantly</p></div><Button variant="ghost" size="sm" onClick={() => { setDraft(BASELINE_PARAMETERS); setActivePreset("custom"); setMessage("Baseline restored. Results updated live."); }}><RotateCcw size={13} />Reset</Button></div>
          <div className="mt-4"><p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[var(--ink-faint)]">Presets</p><div className="grid grid-cols-2 gap-2">{SANDBOX_PRESETS.map((preset) => <button key={preset.id} type="button" onClick={() => loadPreset(preset.id)} className={`rounded-lg border p-2 text-left text-[10px] font-bold ${activePreset === preset.id ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]" : "border-[var(--line)] bg-[var(--canvas)]"}`}><span>{preset.name}</span><span className="mt-1 block font-normal leading-4 text-[var(--ink-muted)]">{preset.description}</span></button>)}</div></div>
          {categories.map((category) => <section key={category} className="mt-5"><h3 className="sticky top-0 z-10 border-b border-[var(--line)] bg-[var(--surface)] py-2 text-[10px] font-extrabold uppercase tracking-wider text-[var(--accent)]">{category}</h3>{POLICY_DEFINITIONS.filter((definition) => definition.category === category).map((definition) => <ParameterControl key={definition.key} parameter={{ id: definition.key, label: definition.label, symbol: definition.unit.trim() || "index", description: definition.description, min: definition.min, max: definition.max, step: definition.step, defaultValue: BASELINE_PARAMETERS[definition.key] } satisfies ModelParameter} value={draft[definition.key]} onChange={(value) => update(definition.key, value)} />)}</section>)}
        </aside>

        <section className="min-w-0 space-y-5">
          <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4"><p className="flex items-center gap-2 text-xs font-bold"><span className="size-2 animate-pulse rounded-full bg-[var(--accent)]" />Live system state</p><p className="mt-1 text-[10px] text-[var(--ink-muted)]">Indicators, charts, and interpretation recalculate locally with every control change. No snapshot or database write is created.</p></div>

          <div className="grid items-stretch gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4 sm:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr]">{[`${result.directContributions.length} active policies`, "Direct effects", `${result.interactionContributions.length} active combinations`, "Total indicators"].map((label, index) => <div key={label} className="contents"><div className={`grid min-h-16 place-items-center rounded-lg p-3 text-center text-[10px] font-bold ${index === 3 ? "bg-[var(--accent)] text-white" : index === 2 ? "bg-[var(--amber-soft)] text-[var(--amber)]" : "bg-[var(--canvas)]"}`}>{label}</div>{index < 3 && <ArrowRight className="mx-auto self-center text-[var(--ink-faint)]" size={14} />}</div>)}</div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{(Object.keys(result.indicators) as IndicatorKey[]).map((key) => <IndicatorCard key={key} indicatorKey={key} value={result.indicators[key]} baseline={BASELINE_INDICATORS[key]} />)}</div>

          <div className="grid gap-5 lg:grid-cols-2">
            <ChartPanel title="Baseline vs current scenario" subtitle="Standardized performance scores; baseline = 100"><div className="h-[340px]"><ResponsiveContainer width="100%" height="100%"><RadarChart data={radarData} outerRadius="70%"><PolarGrid stroke="var(--line)" /><PolarAngleAxis dataKey="dimension" tick={{ fill: "var(--ink-muted)", fontSize: 9 }} /><Radar name="Baseline" dataKey="baseline" stroke="var(--ink-faint)" fill="var(--ink-faint)" fillOpacity={0.06} strokeDasharray="4 4" /><Radar name="Current" dataKey="current" stroke="var(--accent)" fill="var(--accent)" fillOpacity={0.16} /><Legend wrapperStyle={{ fontSize: 10 }} /><Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 8, fontSize: 10 }} /></RadarChart></ResponsiveContainer></div></ChartPanel>
            <ChartPanel title="Policy impact contributions" subtitle="Direct and interaction contributions are shown before the clamped total"><div className="h-[340px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={impactData} layout="vertical" margin={{ top: 8, right: 12, left: 22, bottom: 8 }}><CartesianGrid stroke="var(--line)" strokeDasharray="3 4" horizontal={false} /><XAxis type="number" tick={{ fill: "var(--ink-muted)", fontSize: 9 }} /><YAxis dataKey="policy" type="category" width={86} tick={{ fill: "var(--ink-muted)", fontSize: 9 }} /><Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 8, fontSize: 10 }} /><Legend wrapperStyle={{ fontSize: 10 }} /><Bar dataKey="GDP" fill="var(--blue)" /><Bar dataKey="Revenue" fill="var(--accent)" /><Bar dataKey="Emissions" fill="var(--amber)" /></BarChart></ResponsiveContainer></div></ChartPanel>
          </div>
          <ContributionBreakdown result={result} />
        </section>

        <aside className="space-y-5 xl:sticky xl:top-20">
          <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5"><h2 className="text-sm font-bold">Rule-based interpretation</h2><InterpretationGroup title="Main effects" items={interpretation.mainEffects} /><InterpretationGroup title="Trade-offs" items={interpretation.tradeOffs} /><InterpretationGroup title="Warnings" items={interpretation.warnings} warning /></div>
          <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5"><div className="flex items-center gap-2"><CloudUpload size={15} className="text-[var(--accent)]" /><h2 className="text-sm font-bold">Save scenario</h2></div><p className="mt-2 text-[11px] leading-5 text-[var(--ink-muted)]">Only this deliberate save writes a scenario row to Supabase.</p><input value={scenarioName} onChange={(event) => { setScenarioName(event.target.value); setError(""); }} maxLength={120} placeholder={user ? "Scenario name" : "Sign in to save"} disabled={!user || busy} className="mt-3 h-10 w-full rounded-lg border border-[var(--line-strong)] bg-[var(--canvas)] px-3 text-sm outline-none focus:border-[var(--accent)] disabled:opacity-60" /><Button className="mt-2 w-full" onClick={() => void saveScenario()} disabled={busy}>{busy ? <LoaderCircle className="animate-spin" size={14} /> : <CloudUpload size={14} />}{user ? "Save to workspace" : "Sign in to save"}</Button>{message && <p className="mt-3 flex gap-2 text-[11px] leading-5 text-[var(--accent)]"><CheckCircle2 className="mt-0.5 shrink-0" size={13} />{message}</p>}{error && <p role="alert" className="mt-3 text-[11px] leading-5 text-[var(--red)]">{error}</p>}</div>
          <div className="rounded-xl border border-[var(--line)] bg-[var(--canvas)] p-4"><div className="flex gap-3"><FlaskConical className="shrink-0 text-[var(--accent)]" size={17} /><p className="text-[10px] leading-5 text-[var(--ink-muted)]">Every coefficient is standardized and deterministic. The model communicates direction and trade-offs, not empirical causal estimates.</p></div></div>
        </aside>
      </div>
    </main>
  );
}

function IndicatorCard({ indicatorKey, value, baseline }: { indicatorKey: IndicatorKey; value: number; baseline: number }) {
  const delta = value - baseline;
  const percent = baseline === 0 ? 0 : delta / Math.abs(baseline) * 100;
  const Direction = delta > 0.005 ? ArrowUpRight : delta < -0.005 ? ArrowDownRight : ArrowRight;
  return <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4"><p className="text-[9px] font-bold uppercase tracking-wider text-[var(--ink-faint)]">{indicatorLabels[indicatorKey]}</p><p className="mt-2 text-xl font-bold tabular-nums">{format(value)}{percentIndicators.has(indicatorKey) ? "%" : ""}</p><p className={`mt-2 flex items-center gap-1 text-[10px] font-bold ${delta > 0.005 ? "text-[var(--accent)]" : delta < -0.005 ? "text-[var(--red)]" : "text-[var(--ink-faint)]"}`}><Direction size={12} />{delta > 0 ? "+" : ""}{format(delta)} · {percent > 0 ? "+" : ""}{format(percent)}%</p><p className="mt-1 text-[9px] text-[var(--ink-faint)]">Simulated {percentIndicators.has(indicatorKey) ? "rate" : "index"}</p></div>;
}

function ChartPanel({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return <section className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5"><h2 className="text-sm font-bold">{title}</h2><p className="mt-1 text-[10px] text-[var(--ink-muted)]">{subtitle}</p><div className="mt-4">{children}</div></section>;
}

function InterpretationGroup({ title, items, warning = false }: { title: string; items: string[]; warning?: boolean }) {
  return <section className="mt-5"><h3 className={`text-[10px] font-extrabold uppercase tracking-wider ${warning ? "text-[var(--amber)]" : "text-[var(--ink-faint)]"}`}>{title}</h3><ul className="mt-2 space-y-2">{items.map((item) => <li key={item} className="flex gap-2 text-[11px] leading-5 text-[var(--ink-muted)]"><span aria-hidden="true">{warning ? "!" : "→"}</span><span>{item}</span></li>)}</ul></section>;
}

function ContributionBreakdown({ result }: { result: SandboxResult }) {
  const totals = (key: IndicatorKey, source: SandboxResult["contributions"]) => source.reduce((sum, item) => sum + (item.values[key] ?? 0), 0);
  return <ChartPanel title="Transparent calculation breakdown" subtitle="Standardized teaching coefficients — not estimated causal effects"><div className="grid gap-5 lg:grid-cols-2"><ContributionList title="Direct effects" items={result.directContributions} /><ContributionList title="Interaction effects" items={result.interactionContributions} /></div><div className="mt-5 overflow-x-auto"><table className="w-full min-w-[620px] border-collapse text-xs"><thead><tr className="border-b border-[var(--line)] text-left text-[9px] uppercase tracking-wider text-[var(--ink-faint)]"><th className="p-2">Indicator</th><th className="p-2 text-right">Baseline</th><th className="p-2 text-right">Direct</th><th className="p-2 text-right">Interaction</th><th className="p-2 text-right">Final total</th></tr></thead><tbody>{(Object.keys(result.indicators) as IndicatorKey[]).map((key) => <tr key={key} className="border-b border-[var(--line)] last:border-0"><td className="p-2 font-bold">{indicatorLabels[key]}</td><td className="p-2 text-right font-mono">{format(result.baseline[key])}</td><td className="p-2 text-right font-mono">{signed(totals(key, result.directContributions))}</td><td className="p-2 text-right font-mono text-[var(--amber)]">{signed(totals(key, result.interactionContributions))}</td><td className="p-2 text-right font-mono font-bold text-[var(--accent)]">{format(result.indicators[key])}</td></tr>)}</tbody></table></div></ChartPanel>;
}

function ContributionList({ title, items }: { title: string; items: SandboxResult["contributions"] }) { return <section><h3 className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--accent)]">{title}</h3><div className="mt-2 space-y-2">{items.length === 0 && <p className="rounded-lg bg-[var(--canvas)] p-3 text-[10px] text-[var(--ink-muted)]">No active contribution at the current baseline.</p>}{items.map((item) => <details key={item.label} className="rounded-lg border border-[var(--line)] bg-[var(--canvas)] p-3"><summary className="cursor-pointer text-xs font-bold">{item.label}</summary><p className="mt-2 font-mono text-[10px] text-[var(--accent)]">{item.formula ?? "Deterministic standardized coefficient rule"}</p><p className="mt-2 text-[10px] leading-5 text-[var(--ink-muted)]">{item.rule ?? "The displayed contributions are added to the baseline before the indicator safety bounds are applied."}</p><p className="mt-2 text-[9px] leading-4 text-[var(--ink-faint)]">Current contribution: {Object.entries(item.values).map(([key, value]) => `${key} ${signed(value ?? 0)}`).join(" · ")}</p></details>)}</div></section>; }
function signed(value: number) { const rounded = Math.round(value * 100) / 100; return `${rounded > 0 ? "+" : ""}${format(rounded)}`; }
