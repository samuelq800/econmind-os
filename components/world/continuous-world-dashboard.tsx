"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, AlertTriangle, Clock3, Globe2, Landmark, LoaderCircle, Send } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getActiveWorldPolicies, listContinuousWorlds, listMyContinuousWorldRoles, submitContinuousWorldPolicy, type ContinuousWorldRecord, type ContinuousWorldRoleAssignment, type WorldPolicyDefinition } from "@/lib/supabase/continuous-world";

const roleLabel: Record<string, string> = {
  country_captain: "Country Captain",
  central_bank_governor: "Central Bank Governor",
  economic_policy_minister: "Economic Policy Minister",
  trade_minister: "Trade Minister",
  infrastructure_investment_minister: "Infrastructure & Investment Minister",
  social_labour_minister: "Social & Labour Minister",
  research_innovation_minister: "Research & Innovation Minister",
};

const record = (value: unknown): Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};

function WorldStatePreview({ world }: { world: ContinuousWorldRecord }) {
  const state = record(world.current_state);
  const countries = Array.isArray(state.countries) ? state.countries : [];
  const markets = Array.isArray(state.markets) ? state.markets : [];
  return <div className="mt-5 grid gap-3 sm:grid-cols-3">
    <div className="rounded-lg bg-[var(--surface-subtle)] p-3"><span className="text-[10px] font-bold uppercase tracking-[.14em] text-[var(--ink-faint)]">Countries</span><strong className="mt-1 block text-xl">{countries.length || "—"}</strong></div>
    <div className="rounded-lg bg-[var(--surface-subtle)] p-3"><span className="text-[10px] font-bold uppercase tracking-[.14em] text-[var(--ink-faint)]">Markets</span><strong className="mt-1 block text-xl">{markets.length || "—"}</strong></div>
    <div className="rounded-lg bg-[var(--surface-subtle)] p-3"><span className="text-[10px] font-bold uppercase tracking-[.14em] text-[var(--ink-faint)]">State version</span><strong className="mt-1 block text-xl">{world.state_version}</strong></div>
  </div>;
}

function PolicyForm({ world, roles, policies, onSubmitted }: { world: ContinuousWorldRecord; roles: ContinuousWorldRoleAssignment[]; policies: WorldPolicyDefinition[]; onSubmitted: () => Promise<void> }) {
  const countryRoles = roles.filter((role) => role.world_id === world.id);
  const [countryKey, setCountryKey] = useState(countryRoles[0]?.country_key ?? "");
  const [policyId, setPolicyId] = useState(policies[0]?.id ?? "");
  const effectiveCountryKey = countryRoles.some((role) => role.country_key === countryKey) ? countryKey : (countryRoles[0]?.country_key ?? "");
  const effectivePolicyId = policies.some((policy) => policy.id === policyId) ? policyId : (policies[0]?.id ?? "");
  const selected = policies.find((policy) => policy.id === effectivePolicyId);
  const [change, setChange] = useState(0);
  const effectiveChange = selected ? Math.min(selected.allowed_range[1], Math.max(selected.allowed_range[0], change)) : change;
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  if (!countryRoles.length) return <p className="mt-5 text-sm text-[var(--ink-muted)]">You can view this shared world. A country role is required to submit a policy action.</p>;
  if (!policies.length) return <p className="mt-5 text-sm text-[var(--ink-muted)]">Policy controls will appear once a validated active policy calibration has been imported.</p>;
  async function submit() {
    if (!selected) return;
    setBusy(true); setError(""); setMessage("");
    try {
      await submitContinuousWorldPolicy({ worldId: world.id, countryKey: effectiveCountryKey, policyId: effectivePolicyId, change: effectiveChange });
      setMessage("Policy action scheduled. The server will apply it in the next eligible world tick.");
      await onSubmitted();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "The policy action could not be scheduled."); }
    finally { setBusy(false); }
  }
  return <div className="mt-5 rounded-xl border border-[var(--line)] p-4"><div className="flex items-center gap-2"><Landmark size={16} className="text-[var(--accent)]" /><p className="text-sm font-bold">Submit a calibrated policy action</p></div><p className="mt-1 text-xs leading-5 text-[var(--ink-muted)]">This records a policy decision once. Sliders and previews remain local; only an explicit submission reaches Supabase.</p><div className="mt-4 grid gap-3 md:grid-cols-3"><label className="text-xs font-bold">Country<select value={effectiveCountryKey} onChange={(event) => setCountryKey(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-[var(--line)] bg-[var(--canvas)] px-3 text-sm">{[...new Set(countryRoles.map((role) => role.country_key))].map((country) => <option key={country}>{country}</option>)}</select></label><label className="text-xs font-bold">Instrument<select value={effectivePolicyId} onChange={(event) => setPolicyId(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-[var(--line)] bg-[var(--canvas)] px-3 text-sm">{policies.map((policy) => <option key={policy.id} value={policy.id}>{policy.instrument}</option>)}</select></label><label className="text-xs font-bold">Change ({selected?.unit})<input type="number" min={selected?.allowed_range[0]} max={selected?.allowed_range[1]} value={effectiveChange} onChange={(event) => setChange(Number(event.target.value))} className="mt-1.5 h-10 w-full rounded-lg border border-[var(--line)] bg-[var(--canvas)] px-3 text-sm" /></label></div>{selected && <p className="mt-2 text-xs text-[var(--ink-muted)]">Allowed range: {selected.allowed_range[0]} to {selected.allowed_range[1]}.</p>}{error && <p className="mt-3 text-sm text-[var(--red)]">{error}</p>}{message && <p className="mt-3 text-sm text-[var(--accent)]">{message}</p>}<Button className="mt-4" disabled={busy || !selected || !effectiveCountryKey || change < (selected?.allowed_range[0] ?? 0) || change > (selected?.allowed_range[1] ?? 0)} onClick={() => void submit()}>{busy ? <LoaderCircle className="animate-spin" size={15} /> : <Send size={15} />} Schedule policy</Button></div>;
}

export function ContinuousWorldDashboard() {
  const { user, configured, openAuth } = useAuth();
  const [worlds, setWorlds] = useState<ContinuousWorldRecord[]>([]);
  const [roles, setRoles] = useState<ContinuousWorldRoleAssignment[]>([]);
  const [policies, setPolicies] = useState<WorldPolicyDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const roleSummary = useMemo(() => roles.map((role) => `${role.country_key} · ${roleLabel[role.role_type] ?? role.role_type}`), [roles]);
  const refresh = async () => {
    if (!user || !configured) { setLoading(false); return; }
    setLoading(true); setError("");
    try {
      const [nextWorlds, nextRoles, nextPolicies] = await Promise.all([listContinuousWorlds(), listMyContinuousWorldRoles(user.id), getActiveWorldPolicies()]);
      setWorlds(nextWorlds); setRoles(nextRoles); setPolicies(nextPolicies);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "The continuous world could not be loaded."); }
    finally { setLoading(false); }
  };
  useEffect(() => {
    let active = true;
    if (!user || !configured) {
      queueMicrotask(() => { if (active) setLoading(false); });
      return () => { active = false; };
    }
    void Promise.all([listContinuousWorlds(), listMyContinuousWorldRoles(user.id), getActiveWorldPolicies()]).then(
      ([nextWorlds, nextRoles, nextPolicies]) => { if (active) { setWorlds(nextWorlds); setRoles(nextRoles); setPolicies(nextPolicies); setError(""); setLoading(false); } },
      (caught: unknown) => { if (active) { setError(caught instanceof Error ? caught.message : "The continuous world could not be loaded."); setLoading(false); } },
    );
    return () => { active = false; };
  }, [user, configured]);

  if (!user) return <main className="mx-auto max-w-6xl px-5 py-14"><Card className="p-7 text-center"><Globe2 className="mx-auto text-[var(--accent)]" size={30} /><h1 className="mt-4 text-3xl font-bold">Continuous World Economy</h1><p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-[var(--ink-muted)]">Sign in with an individual EconMind account to view the persistent shared economy.</p><Button className="mt-5" onClick={() => openAuth("sign-in")}>Sign in</Button></Card></main>;
  return <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8"><div className="flex flex-wrap items-end justify-between gap-4"><div><Badge className="border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]">Server-processed · Persistent</Badge><h1 className="mt-3 text-4xl font-bold tracking-[-.055em]">Continuous World Economy</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--ink-muted)]">A shared fictional economy with versioned calibration, durable state snapshots and scheduled server ticks. It does not reuse the older quarter-based League settlement.</p></div><Button variant="secondary" onClick={() => void refresh()} disabled={loading}>{loading && <LoaderCircle className="animate-spin" size={15} />} Refresh state</Button></div>{roleSummary.length > 0 && <Card className="mt-6 border-[var(--accent)] p-4"><p className="text-xs font-bold uppercase tracking-[.14em] text-[var(--accent)]">Your assigned roles</p><p className="mt-2 text-sm">{roleSummary.join(" · ")}</p></Card>}{error && <Card className="mt-6 border-[var(--red)] bg-[var(--red-soft)] p-4 text-sm text-[var(--red)]"><AlertTriangle className="mr-2 inline" size={15} />{error}</Card>}{loading ? <Card className="mt-6 p-8 text-center text-sm text-[var(--ink-muted)]"><LoaderCircle className="mx-auto animate-spin text-[var(--accent)]" size={20} /><p className="mt-3">Loading the current world state…</p></Card> : worlds.length ? <div className="mt-6 space-y-5">{worlds.map((world) => <Card key={world.id} className="p-6"><div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex items-center gap-2"><Activity size={17} className="text-[var(--accent)]" /><h2 className="text-xl font-bold">{world.name}</h2></div><p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--ink-muted)]">{world.description || "A versioned fictional economic world."}</p></div><Badge>{world.status}</Badge></div><WorldStatePreview world={world} /><div className="mt-4 flex items-center gap-2 text-xs text-[var(--ink-muted)]"><Clock3 size={13} /> Next server tick: {world.next_tick_at ? new Date(world.next_tick_at).toLocaleString() : "waiting for activation"} · calibration {world.calibration_version}</div><PolicyForm world={world} roles={roles} policies={policies} onSubmitted={refresh} /></Card>)}</div> : <Card className="mt-6 p-8"><Globe2 className="text-[var(--accent)]" size={24} /><h2 className="mt-4 text-xl font-bold">World launch is intentionally gated</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--ink-muted)]">No active world was found. Import and validate the calibration package, create the initial state, then start the server worker. This screen never invents an economy or presents an empty demo as live.</p></Card>}</main>;
}
