"use client";

import {
  Activity,
  AlertTriangle,
  Check,
  Clock3,
  Crown,
  Fullscreen,
  LoaderCircle,
  MessageCircle,
  Pause,
  Play,
  Radio,
  Sparkles,
  Send,
  ShieldAlert,
  Users,
  X,
} from "lucide-react";
import {
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from "recharts";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  LIVE_WORLD_COUNTRIES,
  LIVE_WORLD_CRISIS_LIBRARY,
  LIVE_WORLD_ROLE_LABELS,
  controlsForLiveWorldRole,
  liveWorldDefaultPolicies,
} from "@/lib/live-world/config";
import {
  agreementPreview,
  forecastLiveWorld,
  rankLiveWorldCountries,
} from "@/lib/live-world/engine";
import { LIVE_WORLD_THEME } from "@/lib/live-world/theme";
import type {
  LiveWorldAgreementDepth,
  LiveWorldCountryId,
  LiveWorldPolicyValues,
  LiveWorldRoomState,
  LiveWorldRoomView,
  LiveWorldRoleId,
} from "@/lib/live-world/types";
import { reconcileLiveWorldDeadline, secondsUntilLiveWorldDeadline } from "@/lib/live-world/timer";
import {
  claimLiveWorldSeat,
  decideLiveWorldAgreement,
  getLiveWorldView,
  injectLiveWorldCrisis,
  joinLiveWorldRoom,
  proposeLiveWorldAgreement,
  publishLiveWorldPolicy,
  postLiveWorldMessage,
  releaseLiveWorldSeat,
  saveLiveWorldDraft,
  setLiveWorldParticipantCapacity,
  setLiveWorldSanction,
  setLiveWorldStatus,
  subscribeToLiveWorldRoom,
  unsubscribeFromLiveWorldRoom,
} from "@/lib/supabase/live-world";

const dimensionLabels = {
  activity: "Activity",
  livelihoods: "Livelihoods",
  prices: "Prices",
  fiscal: "Fiscal",
  financial: "Financial",
  stability: "Stability",
};

function notice(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function formatTime(seconds: number) {
  const safe = Math.max(0, seconds);
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
}

function countryName(countryId: LiveWorldCountryId | null | undefined) {
  return LIVE_WORLD_COUNTRIES.find((country) => country.id === countryId)?.name ?? "Unassigned";
}

function roomStateFromView(view: LiveWorldRoomView): LiveWorldRoomState {
  return {
    publishedPolicies: view.state?.publishedPolicies ?? {},
    agreements: view.state?.agreements ?? [],
    crises: (view.state?.crises ?? []).flatMap((item) => {
      const base = LIVE_WORLD_CRISIS_LIBRARY.find((crisis) => crisis.id === item.id);
      return base ? [{ ...base, active: item.active }] : [];
    }),
    sanctions: view.state?.sanctions ?? [],
  };
}

export function LiveWorldRoom({ roomId }: { roomId: string }) {
  const [view, setView] = useState<LiveWorldRoomView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const hasView = Boolean(view);
  const knownCrisisEvent = useRef<string | null>(null);
  const [broadcast, setBroadcast] = useState<LiveWorldRoomView["events"][number] | null>(null);

  const refresh = useCallback(async () => {
    try {
      const next = await getLiveWorldView(roomId);
      setView(next);
      setError("");
    } catch (caught) {
      setError(notice(caught, "This Live World room could not be opened."));
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  useEffect(() => { queueMicrotask(() => { void refresh(); }); }, [refresh]);
  useEffect(() => {
    if (!hasView) return;
    let active = true;
    let channel: Awaited<ReturnType<typeof subscribeToLiveWorldRoom>> | null = null;
    void subscribeToLiveWorldRoom(roomId, () => { if (active && document.visibilityState === "visible") void refresh(); })
      .then((created) => { channel = created; })
      .catch(() => undefined);
    const interval = window.setInterval(() => { if (active && document.visibilityState === "visible") void refresh(); }, 1500);
    return () => {
      active = false;
      window.clearInterval(interval);
      if (channel) void unsubscribeFromLiveWorldRoom(channel);
    };
  }, [roomId, refresh, hasView]);

  useEffect(() => {
    const newest = view?.events.find((event) => event.type === "crisis_activated");
    if (!newest) return;
    if (!knownCrisisEvent.current) {
      knownCrisisEvent.current = newest.id;
      return;
    }
    if (knownCrisisEvent.current === newest.id) return;
    knownCrisisEvent.current = newest.id;
    const frame = window.requestAnimationFrame(() => setBroadcast(newest));
    return () => window.cancelAnimationFrame(frame);
  }, [view?.events]);

  if (loading) return <LiveWorldShell><LoadingState /></LiveWorldShell>;
  if (!view) return <LiveWorldShell><LiveWorldEntry roomId={roomId} error={error} onJoined={refresh} /></LiveWorldShell>;
  const withBroadcast = (content: React.ReactNode) => <>{content}{broadcast && <CrisisBroadcast event={broadcast} onClose={() => setBroadcast(null)} />}</>;
  if (view.access.type === "observer" || (view.room.status === "ended" && view.access.type !== "admin")) {
    return withBroadcast(<SharedScreen view={view} onRefresh={refresh} />);
  }
  if (view.access.type === "player" && !view.seats.some((seat) => seat.mine)) {
    return withBroadcast(<LiveWorldShell><SeatSelection view={view} onRefresh={refresh} /></LiveWorldShell>);
  }
  if (view.access.type === "admin") return withBroadcast(<AdminRoom view={view} onRefresh={refresh} />);
  return withBroadcast(<PlayerWorkspaceMulti view={view} onRefresh={refresh} />);
}

function LiveWorldShell({ children }: { children: React.ReactNode }) {
  return <main style={LIVE_WORLD_THEME} className="dark min-h-screen bg-[#07120f] px-4 py-5 text-[#edf5f1] sm:px-7 sm:py-8"><div className="mx-auto max-w-7xl">{children}</div></main>;
}

function LoadingState() {
  return <div className="grid min-h-[75vh] place-items-center"><div className="flex items-center gap-3 text-sm text-[#a7bbb1]"><LoaderCircle className="animate-spin text-[#62cbb0]" size={18} /> Opening Live World…</div></div>;
}

function LiveWorldEntry({ roomId, error, onJoined }: { roomId: string; error: string; onJoined: () => Promise<void> }) {
  const [displayName, setDisplayName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(error);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setMessage("");
    try { await joinLiveWorldRoom(roomId, code, displayName); await onJoined(); }
    catch (caught) { setMessage(notice(caught, "The room code could not be accepted.")); }
    finally { setBusy(false); }
  }
  return <div className="grid min-h-[75vh] items-center lg:grid-cols-[1.1fr_.9fr] lg:gap-14"><section><p className="text-[11px] font-extrabold uppercase tracking-[.25em] text-[#62cbb0]">EconMind Live World</p><h1 className="mt-5 max-w-3xl text-5xl font-black tracking-[-.065em] sm:text-7xl">A live economic world.</h1><p className="mt-6 max-w-xl text-base leading-7 text-[#a7bbb1]">This random room link opens a standalone event space. Enter the invitation code to take a cabinet seat, supervise the room, or follow the shared scoreboard.</p><div className="mt-10 grid gap-3 sm:grid-cols-3">{["4 countries", "20 cabinet seats", "One shared clock"].map((item) => <div key={item} className="rounded-xl border border-[#28443a] bg-[#10231c] px-4 py-3 text-xs font-bold text-[#c8d7d0]">{item}</div>)}</div></section><Card className="border-[#345c4c] bg-[#10231c] p-6 shadow-2xl"><p className="text-[10px] font-extrabold uppercase tracking-[.18em] text-[#62cbb0]">Room-only access</p><h2 className="mt-2 text-2xl font-bold text-[#edf5f1]">Join the event</h2><p className="mt-2 text-sm leading-6 text-[#a7bbb1]">Use a player or administrator invitation code. No EconMind account is used, required, or linked; this browser receives a temporary Live World session isolated from the main site.</p><form className="mt-6 grid gap-4" onSubmit={(event) => void submit(event)}><label className="grid gap-2 text-xs font-bold text-[#c8d7d0]">Display name<input autoComplete="nickname" maxLength={48} value={displayName} onChange={(event) => setDisplayName(event.target.value)} className="h-11 rounded-lg border border-[#365c4d] bg-[#07120f] px-3 text-sm text-[#edf5f1] caret-[#62cbb0] outline-none transition placeholder:text-[#71897d] focus:border-[#62cbb0] focus:ring-2 focus:ring-[#62cbb0]/20" placeholder="Enter your name" required /></label><label className="grid gap-2 text-xs font-bold text-[#c8d7d0]">Invitation code<input autoCapitalize="characters" autoComplete="one-time-code" value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} className="h-11 rounded-lg border border-[#365c4d] bg-[#07120f] px-3 font-mono text-sm uppercase tracking-wider text-[#edf5f1] caret-[#62cbb0] outline-none transition placeholder:text-[#71897d] focus:border-[#62cbb0] focus:ring-2 focus:ring-[#62cbb0]/20" placeholder="PLAY-XXXXXXXXXX" required /></label>{message && <p role="alert" className="rounded-lg border border-[#754048] bg-[#542c31] px-3 py-2 text-xs text-[#ffb8bb]">{message}</p>}<Button type="submit" disabled={busy}>{busy && <LoaderCircle size={15} className="animate-spin" />}{busy ? "Entering…" : "Enter Live World"}</Button></form></Card></div>;
}

function Topbar({ view, admin = false }: { view: LiveWorldRoomView; admin?: boolean }) {
  return <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[#294238] pb-5"><div><p className="text-[10px] font-extrabold uppercase tracking-[.2em] text-[#62cbb0]">EconMind · Live World</p><h1 className="mt-1 text-2xl font-black tracking-[-.045em]">{view.room.name}</h1></div><div className="flex items-center gap-3"><Timer room={view.room} /><span className={`rounded-full px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[.13em] ${view.room.status === "live" ? "bg-[#173b31] text-[#62cbb0]" : "bg-[#29312d] text-[#c9d5cf]"}`}>{view.room.status}</span>{admin && <span className="flex items-center gap-1 rounded-full bg-[#3b3320] px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[.13em] text-[#f5c965]"><Crown size={12} /> Admin</span>}</div></header>;
}

function Timer({ room }: { room: LiveWorldRoomView["room"] }) {
  const initialSeconds = room.remainingSeconds ?? room.durationSeconds;
  const deadline = useRef<number | null>(null);
  const startedAt = useRef<string | null>(room.startedAt);
  const [seconds, setSeconds] = useState(initialSeconds);
  useEffect(() => {
    deadline.current = reconcileLiveWorldDeadline(room, deadline.current, startedAt.current);
    startedAt.current = room.startedAt;
    const frame = window.requestAnimationFrame(() => setSeconds(secondsUntilLiveWorldDeadline(deadline.current, room.remainingSeconds ?? room.durationSeconds)));
    return () => window.cancelAnimationFrame(frame);
  }, [room]);
  useEffect(() => {
    if (room.status !== "live") return;
    const interval = window.setInterval(() => setSeconds(secondsUntilLiveWorldDeadline(deadline.current, room.remainingSeconds ?? room.durationSeconds)), 200);
    return () => window.clearInterval(interval);
  }, [room.durationSeconds, room.remainingSeconds, room.status]);
  return <span className="flex items-center gap-2 rounded-lg border border-[#365c4d] bg-[#10231c] px-3 py-2 font-mono text-sm font-bold text-[#f4f8f6]"><Clock3 size={15} className="text-[#62cbb0]" />{formatTime(seconds)}</span>;
}

function SeatSelection({ view, onRefresh, onBack }: { view: LiveWorldRoomView; onRefresh: () => Promise<void>; onBack?: () => void }) {
  const [error, setError] = useState(""); const [busy, setBusy] = useState("");
  const occupied = new Map(view.seats.map((seat) => [`${seat.countryId}:${seat.role}`, seat]));
  async function claim(countryId: LiveWorldCountryId, role: LiveWorldRoleId) { setBusy(`${countryId}:${role}`); setError(""); try { await claimLiveWorldSeat(view.room.id, countryId, role); await onRefresh(); onBack?.(); } catch (caught) { setError(notice(caught, "That seat could not be claimed.")); } finally { setBusy(""); } }
  return <><Topbar view={view} /><section className="py-10"><p className="text-[10px] font-extrabold uppercase tracking-[.2em] text-[#62cbb0]">Cabinet lobby</p><h2 className="mt-2 text-4xl font-black tracking-[-.05em]">Choose one country and one office.</h2><p className="mt-3 max-w-2xl text-sm leading-6 text-[#a7bbb1]">Seats are first-come, first-served. You can change your selection before the administrator starts the room. Every office begins with a published default policy; once the room starts, occupied offices can independently replace their own default.</p>{error && <p role="alert" className="mt-5 rounded-lg bg-[#542c31] px-3 py-2 text-sm text-[#ffb8bb]">{error}</p>}<div className="mt-8 grid gap-4 xl:grid-cols-2">{LIVE_WORLD_COUNTRIES.map((country) => <Card key={country.id} className="border-[#294238] bg-[#10231c] p-5"><div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-[#62cbb0]">{country.shortDescription}</p><h3 className="mt-1 text-xl font-bold">{country.name}</h3></div><span className="grid size-9 place-items-center rounded-lg bg-[#173b31] text-[#62cbb0]"><Activity size={16} /></span></div><div className="mt-5 grid gap-2">{(Object.entries(LIVE_WORLD_ROLE_LABELS) as Array<[LiveWorldRoleId, string]>).map(([role, label]) => { const seat = occupied.get(`${country.id}:${role}`); const key = `${country.id}:${role}`; return <button type="button" key={role} disabled={Boolean(seat) || Boolean(busy)} onClick={() => void claim(country.id, role)} className="flex items-center justify-between rounded-lg border border-[#365c4d] bg-[#07120f] px-3 py-3 text-left transition hover:border-[#62cbb0] disabled:cursor-not-allowed disabled:opacity-45"><span className="text-xs font-bold">{label}</span><span className="text-[11px] text-[#a7bbb1]">{seat ? seat.displayName : busy === key ? "Claiming…" : "Available"}</span></button>; })}</div></Card>)}</div></section></>;
}

// Kept while current room links may still have a legacy single-seat payload.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function PlayerWorkspace({ view, onRefresh }: { view: LiveWorldRoomView; onRefresh: () => Promise<void> }) {
  const countryId = view.access.countryId as LiveWorldCountryId; const role = view.access.role as LiveWorldRoleId;
  const [error, setError] = useState(""); const [released, setReleased] = useState(false);
  async function release() { try { await releaseLiveWorldSeat(view.room.id); setReleased(true); await onRefresh(); } catch (caught) { setError(notice(caught, "Your seat could not be released.")); } }
  if (released || !countryId || !role) return <LiveWorldShell><SeatSelection view={view} onRefresh={onRefresh} /></LiveWorldShell>;
  if (view.room.status !== "live") return <LiveWorldShell><Topbar view={view} /><div className="grid min-h-[62vh] place-items-center"><Card className="max-w-lg border-[#345c4c] bg-[#10231c] p-8 text-center"><Radio className="mx-auto text-[#62cbb0]" size={28} /><h2 className="mt-4 text-2xl font-bold">Your cabinet seat is ready.</h2><p className="mt-3 text-sm leading-6 text-[#a7bbb1]">You are {LIVE_WORLD_ROLE_LABELS[role]} for {countryName(countryId)}. The administrator has not started the timer yet.</p>{error && <p className="mt-4 text-xs text-[#ffb8bb]">{error}</p>}<Button variant="secondary" className="mt-6" onClick={() => void release()}>Release this seat</Button></Card></div></LiveWorldShell>;
  return <LiveWorldShell><Topbar view={view} /><div className="grid gap-5 py-7 xl:grid-cols-[1.05fr_.95fr]"><div className="space-y-5"><CountryBrief countryId={countryId} view={view} /><PolicyPanel view={view} countryId={countryId} role={role} onRefresh={onRefresh} onError={setError} /><TradePanel view={view} countryId={countryId} role={role} onRefresh={onRefresh} onError={setError} /></div><aside className="space-y-5"><ForecastRadar view={view} countryId={countryId} /><Leaderboard view={view} /><ActivityFeed view={view} /></aside></div>{error && <p role="alert" className="fixed bottom-5 left-1/2 z-20 -translate-x-1/2 rounded-lg bg-[#542c31] px-4 py-3 text-sm text-[#ffb8bb] shadow-xl">{error}</p>}</LiveWorldShell>;
}

function CountryBrief({ countryId, view }: { countryId: LiveWorldCountryId; view: LiveWorldRoomView }) {
  const country = LIVE_WORLD_COUNTRIES.find((item) => item.id === countryId)!;
  const teammateCount = view.seats.filter((seat) => seat.countryId === countryId).length;
  return <Card className="border-[#294238] bg-[#10231c] p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-[#62cbb0]">Your country</p><h2 className="mt-1 text-3xl font-black tracking-[-.045em]">{country.name}</h2><p className="mt-2 text-sm text-[#a7bbb1]">{country.shortDescription}</p></div><span className="flex items-center gap-2 rounded-lg bg-[#173b31] px-3 py-2 text-xs font-bold text-[#8edcc8]"><Users size={14} /> {teammateCount}/5 offices filled</span></div><div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">{Object.entries(country.structure).slice(0, 4).map(([key, amount]) => <div key={key} className="rounded-lg border border-[#294238] bg-[#0c1a15] p-3"><p className="text-[9px] font-extrabold uppercase tracking-[.1em] text-[#7f998e]">{key.replace(/[A-Z]/g, (letter) => ` ${letter}`)}</p><p className="mt-1 text-lg font-bold">{amount}</p></div>)}</div></Card>;
}

function PolicyPanel({ view, countryId, role, onRefresh, onError }: { view: LiveWorldRoomView; countryId: LiveWorldCountryId; role: LiveWorldRoleId; onRefresh: () => Promise<void>; onError: (value: string) => void }) {
  const current = useMemo(
    () => view.drafts[countryId]?.[role] ?? view.state.publishedPolicies[countryId]?.[role] ?? liveWorldDefaultPolicies(role),
    [view.drafts, view.state.publishedPolicies, countryId, role],
  );
  const [policy, setPolicy] = useState<LiveWorldPolicyValues>(current);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setPolicy(current));
    return () => window.cancelAnimationFrame(frame);
  }, [current]);
  const controls = controlsForLiveWorldRole(role);
  async function saveDraft() { setBusy(true); try { await saveLiveWorldDraft(view.room.id, policy); await onRefresh(); } catch (caught) { onError(notice(caught, "Your draft could not be saved.")); } finally { setBusy(false); } }
  async function publish() { setBusy(true); try { await saveLiveWorldDraft(view.room.id, policy); await publishLiveWorldPolicy(view.room.id); await onRefresh(); } catch (caught) { onError(notice(caught, "Your policy package could not be published.")); } finally { setBusy(false); } }
  return <Card className="border-[#345c4c] bg-[#10231c] p-5"><p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-[#62cbb0]">Your office</p><h2 className="mt-1 text-2xl font-bold">{LIVE_WORLD_ROLE_LABELS[role]}</h2><p className="mt-2 text-sm leading-6 text-[#a7bbb1]">Your team can see the shared country draft. Only this office can edit these controls; publishing takes effect independently.</p><div className="mt-6 grid gap-5">{controls.map((control) => <label key={control.key} className="block"><div className="flex items-start justify-between gap-4"><span><span className="block text-sm font-bold">{control.label}</span><span className="mt-1 block text-xs leading-5 text-[#8fa79c]">{control.description}</span></span><span className="rounded bg-[#173b31] px-2 py-1 font-mono text-xs font-bold text-[#8edcc8]">{policy[control.key] ?? control.defaultValue}{control.unit ?? ""}</span></div><input type="range" min={control.min} max={control.max} step={control.step} value={policy[control.key] ?? control.defaultValue} onChange={(event) => setPolicy((currentPolicy) => ({ ...currentPolicy, [control.key]: Number(event.target.value) }))} className="mt-3 h-1.5 w-full cursor-pointer accent-[#62cbb0]" /></label>)}</div><div className="mt-7 flex flex-wrap gap-2"><Button variant="secondary" disabled={busy} onClick={() => void saveDraft()}>{busy && <LoaderCircle size={14} className="animate-spin" />} Save team draft</Button><Button disabled={busy} onClick={() => void publish()}><Check size={15} /> Publish my office</Button></div></Card>;
}

function TradePanel({ view, countryId, role, onRefresh, onError }: { view: LiveWorldRoomView; countryId: LiveWorldCountryId; role: LiveWorldRoleId; onRefresh: () => Promise<void>; onError: (value: string) => void }) {
  const [partner, setPartner] = useState<LiveWorldCountryId>(LIVE_WORLD_COUNTRIES.find((country) => country.id !== countryId)?.id ?? "aurora");
  const [depth, setDepth] = useState<LiveWorldAgreementDepth>("standard"); const [busy, setBusy] = useState(false);
  const canTrade = role === "trade_industry_investment_minister";
  const proposal = agreementPreview({ proposerCountry: countryId, receiverCountry: partner, depth });
  async function propose() { setBusy(true); try { await proposeLiveWorldAgreement(view.room.id, partner, depth); await onRefresh(); } catch (caught) { onError(notice(caught, "The trade proposal could not be sent.")); } finally { setBusy(false); } }
  async function decide(id: string, accept: boolean) { setBusy(true); try { await decideLiveWorldAgreement(id, accept); await onRefresh(); } catch (caught) { onError(notice(caught, "The agreement decision could not be recorded.")); } finally { setBusy(false); } }
  const incoming = view.state.agreements.filter((agreement) => agreement.receiverCountry === countryId && agreement.status === "proposed");
  return <Card className="border-[#294238] bg-[#10231c] p-5"><p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-[#62cbb0]">International agreements</p><h2 className="mt-1 text-xl font-bold">Trade desk</h2>{canTrade ? <><div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="grid gap-1.5 text-xs font-bold">Partner<select value={partner} onChange={(event) => setPartner(event.target.value as LiveWorldCountryId)} className="h-10 rounded-lg border border-[#365c4d] bg-[#07120f] px-3 text-sm">{LIVE_WORLD_COUNTRIES.filter((country) => country.id !== countryId).map((country) => <option key={country.id} value={country.id}>{country.name}</option>)}</select></label><label className="grid gap-1.5 text-xs font-bold">Depth<select value={depth} onChange={(event) => setDepth(event.target.value as LiveWorldAgreementDepth)} className="h-10 rounded-lg border border-[#365c4d] bg-[#07120f] px-3 text-sm"><option value="limited">Limited</option><option value="standard">Standard</option><option value="deep">Deep</option></select></label></div><p className="mt-3 rounded-lg bg-[#0c1a15] p-3 text-xs leading-5 text-[#a7bbb1]">Forecasted activity lift: {countryName(countryId)} <strong className="text-[#8edcc8]">+{proposal.proposer}</strong> · {countryName(partner)} <strong className="text-[#8edcc8]">+{proposal.receiver}</strong>. The effects differ because economies are structurally distinct.</p><Button className="mt-3" size="sm" disabled={busy} onClick={() => void propose()}>Propose agreement</Button></> : <p className="mt-3 text-sm leading-6 text-[#a7bbb1]">Only the Trade, Industry & Investment Minister may propose or decide international agreements.</p>}<div className="mt-5 space-y-2">{incoming.map((agreement) => <div key={agreement.id} className="rounded-lg border border-[#3d564b] bg-[#0c1a15] p-3"><p className="text-xs font-bold">{countryName(agreement.proposerCountry)} proposes a {agreement.depth} agreement.</p>{canTrade && <div className="mt-3 flex gap-2"><Button size="sm" disabled={busy} onClick={() => void decide(agreement.id, true)}>Accept</Button><Button size="sm" variant="secondary" disabled={busy} onClick={() => void decide(agreement.id, false)}>Reject</Button></div>}</div>)}{!incoming.length && <p className="text-xs text-[#8fa79c]">No incoming proposal.</p>}</div></Card>;
}

function PlayerWorkspaceMulti({ view, onRefresh }: { view: LiveWorldRoomView; onRefresh: () => Promise<void> }) {
  const mySeats = view.seats.filter((seat) => seat.mine);
  const [activeKey, setActiveKey] = useState("");
  const [selectingOffice, setSelectingOffice] = useState(false);
  const [error, setError] = useState("");
  const activeSeat = mySeats.find((seat) => `${seat.countryId}:${seat.role}` === activeKey) ?? mySeats[0];
  async function release() {
    if (!activeSeat) return;
    try { await releaseLiveWorldSeat(view.room.id, activeSeat.countryId, activeSeat.role); await onRefresh(); }
    catch (caught) { setError(notice(caught, "This office could not be released.")); }
  }
  if (!activeSeat || selectingOffice) return <LiveWorldShell><SeatSelection view={view} onRefresh={onRefresh} onBack={activeSeat ? () => setSelectingOffice(false) : undefined} /></LiveWorldShell>;
  const officeSwitcher = <Card className="border-[#294238] bg-[#10231c] p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-[#62cbb0]">Your appointments</p><p className="mt-1 text-xs text-[#a7bbb1]">One player can manage multiple offices and switch between them here.</p></div>{view.room.status === "waiting" && <Button size="sm" variant="secondary" onClick={() => setSelectingOffice(true)}>Claim another office</Button>}</div><div className="mt-3 flex flex-wrap gap-2">{mySeats.map((seat) => { const key = `${seat.countryId}:${seat.role}`; return <button type="button" key={key} onClick={() => setActiveKey(key)} className={`rounded-lg border px-3 py-2 text-left text-xs transition ${activeSeat.countryId === seat.countryId && activeSeat.role === seat.role ? "border-[#62cbb0] bg-[#173b31] text-[#dff9ee]" : "border-[#365c4d] bg-[#0c1a15] text-[#a7bbb1] hover:border-[#62cbb0]"}`}><b className="block">{LIVE_WORLD_ROLE_LABELS[seat.role]}</b><span>{countryName(seat.countryId)}</span></button>; })}</div></Card>;
  if (view.room.status !== "live") return <LiveWorldShell><Topbar view={view} /><div className="mx-auto grid min-h-[62vh] max-w-3xl place-items-center"><div className="w-full"><div className="mb-5">{officeSwitcher}</div><Card className="border-[#345c4c] bg-[#10231c] p-8 text-center"><Radio className="mx-auto text-[#62cbb0]" size={28} /><h2 className="mt-4 text-2xl font-bold">Your cabinet appointments are ready.</h2><p className="mt-3 text-sm leading-6 text-[#a7bbb1]">You are currently managing {LIVE_WORLD_ROLE_LABELS[activeSeat.role]} for {countryName(activeSeat.countryId)}. Empty offices will continue with default policies when the timer starts.</p><Button variant="secondary" className="mt-6" onClick={() => void release()}>Release selected office</Button></Card></div></div>{error && <p role="alert" className="fixed bottom-5 left-1/2 z-20 -translate-x-1/2 rounded-lg bg-[#542c31] px-4 py-3 text-sm text-[#ffb8bb] shadow-xl">{error}</p>}</LiveWorldShell>;
  return <LiveWorldShell><Topbar view={view} /><div className="space-y-5 py-7">{officeSwitcher}<div className="grid gap-5 xl:grid-cols-[1.05fr_.95fr]"><div className="space-y-5"><CountryBrief countryId={activeSeat.countryId} view={view} /><StablePolicyPanel view={view} countryId={activeSeat.countryId} role={activeSeat.role} onRefresh={onRefresh} onError={setError} /><DiplomacyPanel view={view} countryId={activeSeat.countryId} role={activeSeat.role} onRefresh={onRefresh} onError={setError} /></div><aside className="space-y-5"><ForecastRadar view={view} countryId={activeSeat.countryId} /><Leaderboard view={view} /><ActivityFeed view={view} /></aside></div><WorldSituationPanel view={view} /><RoomChat view={view} countryId={activeSeat.countryId} onRefresh={onRefresh} onError={setError} /></div>{error && <p role="alert" className="fixed bottom-5 left-1/2 z-20 -translate-x-1/2 rounded-lg bg-[#542c31] px-4 py-3 text-sm text-[#ffb8bb] shadow-xl">{error}</p>}</LiveWorldShell>;
}

function StablePolicyPanel({ view, countryId, role, onRefresh, onError }: { view: LiveWorldRoomView; countryId: LiveWorldCountryId; role: LiveWorldRoleId; onRefresh: () => Promise<void>; onError: (value: string) => void }) {
  const persisted = useMemo(() => view.drafts[countryId]?.[role] ?? view.state.publishedPolicies[countryId]?.[role] ?? liveWorldDefaultPolicies(role), [view.drafts, view.state.publishedPolicies, countryId, role]);
  const signature = JSON.stringify(persisted); const scope = `${countryId}:${role}`;
  const [policy, setPolicy] = useState<LiveWorldPolicyValues>(persisted); const [dirty, setDirty] = useState(false); const [busy, setBusy] = useState(false);
  const previous = useRef({ scope, signature });
  useEffect(() => { if (previous.current.scope === scope && (dirty || previous.current.signature === signature)) { previous.current = { scope, signature }; return; } previous.current = { scope, signature }; const frame = window.requestAnimationFrame(() => { setPolicy(persisted); setDirty(false); }); return () => window.cancelAnimationFrame(frame); }, [scope, signature, persisted, dirty]);
  const controls = controlsForLiveWorldRole(role);
  async function saveDraft() { setBusy(true); try { await saveLiveWorldDraft(view.room.id, countryId, role, policy); setDirty(false); await onRefresh(); } catch (caught) { onError(notice(caught, "Your draft could not be saved.")); } finally { setBusy(false); } }
  async function publish() { setBusy(true); try { await saveLiveWorldDraft(view.room.id, countryId, role, policy); await publishLiveWorldPolicy(view.room.id, countryId, role); setDirty(false); await onRefresh(); } catch (caught) { onError(notice(caught, "Your policy package could not be published.")); } finally { setBusy(false); } }
  return <Card className="border-[#345c4c] bg-[#10231c] p-5"><p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-[#62cbb0]">Your office</p><h2 className="mt-1 text-2xl font-bold">{LIVE_WORLD_ROLE_LABELS[role]}</h2><p className="mt-2 text-sm leading-6 text-[#a7bbb1]">Controls stay in place while you adjust them. Save a draft for your team, or publish this office independently.</p><div className="mt-6 grid gap-5">{controls.map((control) => <label key={control.key} className="block"><div className="flex items-start justify-between gap-4"><span><span className="block text-sm font-bold">{control.label}</span><span className="mt-1 block text-xs leading-5 text-[#8fa79c]">{control.description}</span><span className="mt-2 flex items-start gap-1.5 text-[11px] leading-4 text-[#8edcc8]"><Sparkles size={12} className="mt-0.5 shrink-0" />Impact note: {control.impact}</span></span><span className="rounded bg-[#173b31] px-2 py-1 font-mono text-xs font-bold text-[#8edcc8]">{policy[control.key] ?? control.defaultValue}{control.unit ?? ""}</span></div><input type="range" min={control.min} max={control.max} step={control.step} value={policy[control.key] ?? control.defaultValue} onChange={(event) => { setDirty(true); setPolicy((current) => ({ ...current, [control.key]: Number(event.target.value) })); }} className="mt-3 h-1.5 w-full cursor-pointer accent-[#62cbb0]" /></label>)}</div><div className="mt-7 flex flex-wrap gap-2"><Button variant="secondary" disabled={busy} onClick={() => void saveDraft()}>{busy && <LoaderCircle size={14} className="animate-spin" />} Save team draft</Button><Button disabled={busy} onClick={() => void publish()}><Check size={15} /> Publish my office</Button></div></Card>;
}

function DiplomacyPanel({ view, countryId, role, onRefresh, onError }: { view: LiveWorldRoomView; countryId: LiveWorldCountryId; role: LiveWorldRoleId; onRefresh: () => Promise<void>; onError: (value: string) => void }) {
  const otherCountries = LIVE_WORLD_COUNTRIES.filter((country) => country.id !== countryId);
  const [partner, setPartner] = useState<LiveWorldCountryId>(otherCountries[0]?.id ?? "aurora"); const [depth, setDepth] = useState<LiveWorldAgreementDepth>("standard"); const [tariff, setTariff] = useState(10); const [busy, setBusy] = useState(false);
  const canTrade = role === "trade_industry_investment_minister"; const proposal = agreementPreview({ proposerCountry: countryId, receiverCountry: partner, depth });
  async function propose() { setBusy(true); try { await proposeLiveWorldAgreement(view.room.id, countryId, partner, depth); await onRefresh(); } catch (caught) { onError(notice(caught, "The trade proposal could not be sent.")); } finally { setBusy(false); } }
  async function decide(id: string, accept: boolean) { setBusy(true); try { await decideLiveWorldAgreement(id, countryId, accept); await onRefresh(); } catch (caught) { onError(notice(caught, "The agreement decision could not be recorded.")); } finally { setBusy(false); } }
  async function sanction() { setBusy(true); try { await setLiveWorldSanction(view.room.id, countryId, partner, tariff); await onRefresh(); } catch (caught) { onError(notice(caught, "The tariff sanction could not be updated.")); } finally { setBusy(false); } }
  const incoming = view.state.agreements.filter((agreement) => agreement.receiverCountry === countryId && agreement.status === "proposed"); const activeSanctions = view.state.sanctions.filter((item) => item.status === "active" && (item.initiatorCountry === countryId || item.targetCountry === countryId));
  return <Card className="border-[#294238] bg-[#10231c] p-5"><p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-[#62cbb0]">International desk</p><h2 className="mt-1 text-xl font-bold">Trade & economic sanctions</h2>{canTrade ? <><div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="grid gap-1.5 text-xs font-bold">Partner / target<select value={partner} onChange={(event) => setPartner(event.target.value as LiveWorldCountryId)} className="h-10 rounded-lg border border-[#365c4d] bg-[#07120f] px-3 text-sm">{otherCountries.map((country) => <option key={country.id} value={country.id}>{country.name}</option>)}</select></label><label className="grid gap-1.5 text-xs font-bold">Trade depth<select value={depth} onChange={(event) => setDepth(event.target.value as LiveWorldAgreementDepth)} className="h-10 rounded-lg border border-[#365c4d] bg-[#07120f] px-3 text-sm"><option value="limited">Limited</option><option value="standard">Standard</option><option value="deep">Deep</option></select></label></div><p className="mt-3 rounded-lg bg-[#0c1a15] p-3 text-xs leading-5 text-[#a7bbb1]">Agreement forecast: {countryName(countryId)} <strong className="text-[#8edcc8]">+{proposal.proposer}</strong> activity · {countryName(partner)} <strong className="text-[#8edcc8]">+{proposal.receiver}</strong>.</p><Button className="mt-3" size="sm" disabled={busy} onClick={() => void propose()}>Propose agreement</Button><div className="mt-5 border-t border-[#294238] pt-5"><div className="flex items-center justify-between gap-3"><div><p className="text-sm font-bold">Tariff sanction</p><p className="mt-1 text-xs leading-5 text-[#a7bbb1]">Raises the target’s import costs and activity pressure, with a smaller domestic trade cost.</p></div><ShieldAlert className="text-[#f5c965]" size={20} /></div><div className="mt-3 flex items-center gap-3"><input aria-label="Tariff rate" type="range" min="0" max="40" step="1" value={tariff} onChange={(event) => setTariff(Number(event.target.value))} className="h-1.5 flex-1 cursor-pointer accent-[#f5c965]" /><span className="min-w-12 rounded bg-[#3b3320] px-2 py-1 text-center font-mono text-xs font-bold text-[#f5c965]">{tariff}%</span><Button size="sm" variant="secondary" disabled={busy} onClick={() => void sanction()}>{tariff === 0 ? "Revoke" : "Set tariff"}</Button></div></div></> : <p className="mt-3 text-sm leading-6 text-[#a7bbb1]">Only the Trade, Industry & Investment Minister may propose, decide or sanction international economic relations.</p>}<div className="mt-5 space-y-2">{incoming.map((agreement) => <div key={agreement.id} className="rounded-lg border border-[#3d564b] bg-[#0c1a15] p-3"><p className="text-xs font-bold">{countryName(agreement.proposerCountry)} proposes a {agreement.depth} agreement.</p>{canTrade && <div className="mt-3 flex gap-2"><Button size="sm" disabled={busy} onClick={() => void decide(agreement.id, true)}>Accept</Button><Button size="sm" variant="secondary" disabled={busy} onClick={() => void decide(agreement.id, false)}>Reject</Button></div>}</div>)}{activeSanctions.map((item) => <p key={item.id} className="rounded-lg border border-[#604a27] bg-[#2d2518] px-3 py-2 text-xs text-[#f5d68a]">{countryName(item.initiatorCountry)} → {countryName(item.targetCountry)}: {item.tariffRate}% tariff active</p>)}{!incoming.length && !activeSanctions.length && <p className="text-xs text-[#8fa79c]">No incoming proposal or active tariff affecting this country.</p>}</div></Card>;
}

function WorldSituationPanel({ view }: { view: LiveWorldRoomView }) {
  const ranks = rankLiveWorldCountries(roomStateFromView(view));
  return <Card className="border-[#294238] bg-[#10231c] p-5"><p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-[#62cbb0]">World situation</p><h2 className="mt-1 text-xl font-bold">Other economies at a glance</h2><div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">{ranks.map((rank) => <div key={rank.countryId} className="rounded-lg border border-[#294238] bg-[#0c1a15] p-3"><div className="flex items-center justify-between"><p className="text-sm font-bold">{countryName(rank.countryId)}</p><b className="font-mono text-[#8edcc8]">{rank.score}</b></div><p className="mt-2 text-xs text-[#a7bbb1]">Activity {rank.dimensions.activity} · Prices {rank.dimensions.prices} · Stability {rank.dimensions.stability}</p></div>)}</div></Card>;
}

function RoomChat({ view, countryId, onRefresh, onError }: { view: LiveWorldRoomView; countryId: LiveWorldCountryId; onRefresh: () => Promise<void>; onError: (value: string) => void }) {
  const [body, setBody] = useState(""); const [busy, setBusy] = useState(false);
  async function send(event: React.FormEvent) { event.preventDefault(); if (!body.trim()) return; setBusy(true); try { await postLiveWorldMessage(view.room.id, body, countryId); setBody(""); await onRefresh(); } catch (caught) { onError(notice(caught, "Your message could not be sent.")); } finally { setBusy(false); } }
  return <Card className="border-[#294238] bg-[#10231c] p-5"><div className="flex items-center gap-2"><MessageCircle className="text-[#62cbb0]" size={17} /><div><p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-[#62cbb0]">Room chat</p><h2 className="text-xl font-bold">Cabinet channel</h2></div></div><div className="mt-4 max-h-64 space-y-2 overflow-y-auto pr-1">{view.messages.map((message) => <div key={message.id} className="rounded-lg border border-[#294238] bg-[#0c1a15] px-3 py-2"><p className="text-xs font-bold text-[#dff9ee]">{message.displayName}{message.countryId && <span className="ml-2 font-normal text-[#62cbb0]">· {countryName(message.countryId)}</span>}</p><p className="mt-1 text-sm text-[#c8d7d0]">{message.body}</p></div>)}{!view.messages.length && <p className="text-sm text-[#8fa79c]">No messages yet. Use this channel to coordinate trade, policy and crisis response.</p>}</div><form className="mt-4 flex gap-2" onSubmit={(event) => void send(event)}><input value={body} maxLength={500} onChange={(event) => setBody(event.target.value)} placeholder="Send a message to the room…" className="h-10 min-w-0 flex-1 rounded-lg border border-[#365c4d] bg-[#07120f] px-3 text-sm outline-none focus:border-[#62cbb0]" /><Button size="sm" type="submit" disabled={busy}><Send size={15} /> Send</Button></form></Card>;
}

function CrisisBroadcast({ event, onClose }: { event: LiveWorldRoomView["events"][number]; onClose: () => void }) {
  const details = event.details ?? {}; return <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 grid place-items-center bg-[#030806]/90 p-5 backdrop-blur-md"><div className="relative w-full max-w-3xl overflow-hidden rounded-3xl border border-[#b16b44] bg-[radial-gradient(circle_at_top,#4a2d20,#10231c_58%,#07120f)] p-7 shadow-2xl sm:p-11"><div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#f5c965] via-[#ff7f62] to-[#f5c965]" /><button type="button" aria-label="Close broadcast" onClick={onClose} className="absolute right-5 top-5 rounded-lg border border-[#a66149] p-2 text-[#ffd2bd] hover:bg-white/10"><X size={18} /></button><div className="flex items-center gap-3 text-[#f5c965]"><AlertTriangle size={24} /><p className="text-[11px] font-extrabold uppercase tracking-[.22em]">Global event bulletin</p></div><h2 className="mt-6 text-4xl font-black tracking-[-.05em] sm:text-6xl">{details.title ?? event.message}</h2><p className="mt-5 max-w-2xl text-lg leading-8 text-[#d9e4df]">{details.description ?? "A sudden event has changed the shared economic environment. Review the situation and coordinate a response."}</p><div className="mt-7 grid gap-3 sm:grid-cols-3">{(details.impacts ?? ["Review your country forecast", "Coordinate with other offices", "Publish a policy response"]).map((impact) => <div key={impact} className="rounded-xl border border-[#82513d] bg-[#07120f]/55 p-4 text-sm leading-6 text-[#ffdac8]">{impact}</div>)}</div><div className="mt-7 rounded-xl border border-[#436958] bg-[#0c1a15]/70 p-4"><p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-[#62cbb0]">Recommended response</p><p className="mt-2 text-sm leading-6 text-[#d7e9e0]">{details.responseHint ?? "Compare the forecast, discuss the trade-offs, and publish office-specific measures."}</p></div><Button className="mt-7" onClick={onClose}>Acknowledge event</Button></div></div>;
}

function ForecastRadar({ view, countryId }: { view: LiveWorldRoomView; countryId: LiveWorldCountryId }) {
  const state = roomStateFromView(view);
  state.publishedPolicies = { ...state.publishedPolicies, [countryId]: { ...(state.publishedPolicies[countryId] ?? {}), ...(view.drafts[countryId] ?? {}) } };
  const forecast = forecastLiveWorld(state)[countryId];
  const baseline = LIVE_WORLD_COUNTRIES.find((country) => country.id === countryId)!.baseline;
  const data = Object.entries(dimensionLabels).map(([key, label]) => ({ dimension: label, baseline: baseline[key as keyof typeof baseline], forecast: forecast[key as keyof typeof forecast] }));
  return <Card className="overflow-hidden border-[#345c4c] bg-[#10231c] p-0"><div className="border-b border-[#294238] p-5"><p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-[#62cbb0]">Six dimensions</p><h2 className="mt-1 text-xl font-bold">Combined forecast</h2><p className="mt-2 text-xs leading-5 text-[#a7bbb1]">Drafts, published policies, active crises and trade agreements are combined in this short-event forecast.</p></div><div className="h-[310px] p-3"><ResponsiveContainer width="100%" height="100%"><RadarChart data={data} outerRadius="68%"><PolarGrid stroke="#365c4d" /><PolarAngleAxis dataKey="dimension" tick={{ fill: "#a7bbb1", fontSize: 10 }} /><Radar dataKey="baseline" stroke="#758b80" fill="#758b80" fillOpacity={0.08} strokeDasharray="4 4" /><Radar dataKey="forecast" stroke="#62cbb0" fill="#62cbb0" fillOpacity={0.22} /></RadarChart></ResponsiveContainer></div></Card>;
}

function Leaderboard({ view }: { view: LiveWorldRoomView }) {
  const ranks = rankLiveWorldCountries(roomStateFromView(view));
  return <Card className="border-[#294238] bg-[#10231c] p-5"><p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-[#62cbb0]">Live ranking</p><div className="mt-4 space-y-2">{ranks.map((item, index) => <div key={item.countryId} className="flex items-center justify-between rounded-lg border border-[#294238] bg-[#0c1a15] px-3 py-2.5"><span className="flex items-center gap-3"><b className="w-4 text-[#62cbb0]">{index + 1}</b><span className="text-sm font-bold">{countryName(item.countryId)}</span></span><b className="font-mono text-sm">{item.score}</b></div>)}</div></Card>;
}

function ActivityFeed({ view }: { view: LiveWorldRoomView }) {
  return <Card className="border-[#294238] bg-[#10231c] p-5"><p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-[#62cbb0]">Activity feed</p><div className="mt-4 space-y-3">{view.events.slice(0, 8).map((event) => <div key={event.id} className="border-l border-[#365c4d] pl-3"><p className="text-xs leading-5 text-[#cddbd4]">{event.message}</p><p className="mt-1 text-[10px] text-[#71897d]">{new Date(event.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p></div>)}{!view.events.length && <p className="text-xs text-[#8fa79c]">The live feed will appear when the room begins.</p>}</div></Card>;
}

function AdminRoom({ view, onRefresh }: { view: LiveWorldRoomView; onRefresh: () => Promise<void> }) {
  const [busy, setBusy] = useState(""); const [error, setError] = useState("");
  const [participantCapacity, setParticipantCapacity] = useState(view.room.participantCapacity);
  async function status(next: "live" | "paused" | "ended") { setBusy(next); try { await setLiveWorldStatus(view.room.id, next); await onRefresh(); } catch (caught) { setError(notice(caught, "Room control could not be updated.")); } finally { setBusy(""); } }
  async function updateParticipantCapacity() { setBusy("capacity"); try { await setLiveWorldParticipantCapacity(view.room.id, participantCapacity); await onRefresh(); } catch (caught) { setError(notice(caught, "Player capacity could not be updated.")); } finally { setBusy(""); } }
  async function setCrisis(id: string, active: boolean) { setBusy(id); try { await injectLiveWorldCrisis(view.room.id, id, active); await onRefresh(); } catch (caught) { setError(notice(caught, "Crisis control could not be updated.")); } finally { setBusy(""); } }
  const activeCrises = new Set(view.state.crises.filter((crisis) => crisis.active).map((crisis) => crisis.id));
  return <LiveWorldShell><Topbar view={view} admin /><div className="grid gap-5 py-7 xl:grid-cols-[1.05fr_.95fr]"><section className="space-y-5"><Card className="border-[#c49f4d] bg-[#1b2118] p-6"><p className="text-[10px] font-extrabold uppercase tracking-[.18em] text-[#f5c965]">Room control</p><h2 className="mt-2 text-3xl font-black tracking-[-.045em]">Run the live event.</h2><p className="mt-3 max-w-xl text-sm leading-6 text-[#b7c3bc]">Starting locks seats and publishes a default policy for every office. Players can then independently replace their own office policy; vacant offices never block the event.</p>{view.room.status === "waiting" && <div className="mt-5 flex flex-wrap items-end gap-3 rounded-lg border border-[#66582f] bg-[#282719] p-4"><label className="grid gap-1.5 text-xs font-bold text-[#f5e8bd]">Player capacity<input type="number" min={1} max={20} value={participantCapacity} onChange={(event) => setParticipantCapacity(Math.min(20, Math.max(1, Number(event.target.value) || 1)))} className="h-10 w-28 rounded-lg border border-[#8b7a3b] bg-[#101a15] px-3 font-mono text-sm text-[#edf5f1]" /></label><Button variant="secondary" disabled={Boolean(busy) || participantCapacity === view.room.participantCapacity} onClick={() => void updateParticipantCapacity()}>{busy === "capacity" && <LoaderCircle size={14} className="animate-spin" />} Update player limit</Button><p className="pb-2 text-xs text-[#b7c3bc]">{participantCapacity} player places available across 20 cabinet offices.</p></div>}<div className="mt-6 flex flex-wrap gap-2">{view.room.status === "waiting" && <Button disabled={Boolean(busy)} onClick={() => void status("live")}><Play size={15} /> Start room</Button>}{view.room.status === "live" && <Button variant="secondary" disabled={Boolean(busy)} onClick={() => void status("paused")}><Pause size={15} /> Pause</Button>}{view.room.status === "paused" && <Button disabled={Boolean(busy)} onClick={() => void status("live")}><Play size={15} /> Resume</Button>}{view.room.status !== "ended" && <Button variant="danger" disabled={Boolean(busy)} onClick={() => void status("ended")}>End room</Button>}<button type="button" onClick={() => window.open(`${window.location.pathname}?room=${view.room.id}&screen=shared`, "_blank", "noopener,noreferrer")} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[#c49f4d] px-4 text-sm font-semibold text-[#f5c965] hover:bg-[#3b3320]"><Fullscreen size={15} /> Open shared screen</button></div>{error && <p role="alert" className="mt-4 rounded-lg bg-[#542c31] px-3 py-2 text-sm text-[#ffb8bb]">{error}</p>}</Card><Card className="border-[#294238] bg-[#10231c] p-5"><p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-[#62cbb0]">Crisis console</p><div className="mt-4 grid gap-3 sm:grid-cols-2">{LIVE_WORLD_CRISIS_LIBRARY.map((crisis) => <div key={crisis.id} className="rounded-lg border border-[#365c4d] bg-[#0c1a15] p-4"><p className="text-sm font-bold">{crisis.label}</p><p className="mt-1 text-xs leading-5 text-[#8fa79c]">{crisis.description}</p><Button className="mt-3" size="sm" variant={activeCrises.has(crisis.id) ? "secondary" : "primary"} disabled={Boolean(busy)} onClick={() => void setCrisis(crisis.id, !activeCrises.has(crisis.id))}>{activeCrises.has(crisis.id) ? "Resolve" : "Activate"}</Button></div>)}</div></Card></section><aside className="space-y-5"><Leaderboard view={view} /><Card className="border-[#294238] bg-[#10231c] p-5"><p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-[#62cbb0]">Seat register</p><div className="mt-4 space-y-2">{LIVE_WORLD_COUNTRIES.map((country) => <div key={country.id} className="rounded-lg border border-[#294238] bg-[#0c1a15] p-3"><p className="text-sm font-bold">{country.name}</p><div className="mt-2 grid gap-1">{(Object.entries(LIVE_WORLD_ROLE_LABELS) as Array<[LiveWorldRoleId, string]>).map(([role, label]) => <p key={role} className="text-xs text-[#8fa79c]"><span className="text-[#cddbd4]">{label}:</span> {view.seats.find((seat) => seat.countryId === country.id && seat.role === role)?.displayName ?? "Vacant · default policy active"}</p>)}</div></div>)}</div></Card></aside></div></LiveWorldShell>;
}

function SharedScreen({ view, onRefresh }: { view: LiveWorldRoomView; onRefresh: () => Promise<void> }) {
  const ranks = rankLiveWorldCountries(roomStateFromView(view));
  const [full, setFull] = useState(false);
  useEffect(() => { if (new URLSearchParams(window.location.search).get("screen") === "shared") { void document.documentElement.requestFullscreen?.().then(() => setFull(true)).catch(() => undefined); } }, []);
  return <main style={LIVE_WORLD_THEME} className="dark min-h-screen bg-[#07120f] p-5 text-[#edf5f1] sm:p-8"><div className="mx-auto max-w-[1600px]"><header className="flex flex-wrap items-center justify-between gap-4 border-b border-[#294238] pb-6"><div><p className="text-[11px] font-extrabold uppercase tracking-[.25em] text-[#62cbb0]">EconMind Live World · shared screen</p><h1 className="mt-2 text-4xl font-black tracking-[-.06em] sm:text-6xl">{view.room.name}</h1></div><div className="flex items-center gap-3"><Timer room={view.room} /><button type="button" onClick={() => { if (document.fullscreenElement) void document.exitFullscreen(); else void document.documentElement.requestFullscreen(); setFull(!full); }} className="grid size-10 place-items-center rounded-lg border border-[#365c4d] bg-[#10231c] text-[#62cbb0]" aria-label="Toggle fullscreen"><Fullscreen size={17} /></button></div></header><div className="grid gap-5 py-7 xl:grid-cols-[1.3fr_.7fr]"><section className="grid gap-4 sm:grid-cols-2">{ranks.map((item, index) => <Card key={item.countryId} className="border-[#345c4c] bg-[#10231c] p-6"><div className="flex items-start justify-between"><div><p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-[#62cbb0]">Rank {index + 1}</p><h2 className="mt-2 text-3xl font-black">{countryName(item.countryId)}</h2></div><p className="font-mono text-4xl font-black text-[#f5c965]">{item.score}</p></div><div className="mt-6 grid grid-cols-3 gap-2">{Object.entries(item.dimensions).map(([dimension, score]) => <div key={dimension} className="rounded-lg bg-[#0c1a15] p-2.5"><p className="text-[9px] font-extrabold uppercase tracking-[.08em] text-[#71897d]">{dimensionLabels[dimension as keyof typeof dimensionLabels]}</p><p className="mt-1 font-mono text-lg font-bold">{score}</p></div>)}</div></Card>)}</section><aside className="space-y-5"><Card className="border-[#c49f4d] bg-[#1b2118] p-5"><p className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[.16em] text-[#f5c965]"><Sparkles size={13} /> Active conditions</p><div className="mt-3 space-y-2">{roomStateFromView(view).crises.filter((crisis) => crisis.active).map((crisis) => <p key={crisis.id} className="rounded-lg bg-[#2c291d] px-3 py-2 text-sm font-bold">{crisis.label}</p>)}{!roomStateFromView(view).crises.some((crisis) => crisis.active) && <p className="text-sm text-[#b7c3bc]">No active crisis.</p>}</div></Card><ActivityFeed view={view} /><button type="button" onClick={() => void onRefresh()} className="w-full rounded-lg border border-[#365c4d] py-3 text-xs font-bold text-[#8edcc8]">Refresh display</button></aside></div></div></main>;
}
