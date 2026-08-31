"use client";

import Link from "next/link";
import { Copy, Gamepad2, LoaderCircle, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  createLiveWorldRoom,
  listLiveWorldRoomsForAdmin,
  type CreatedLiveWorldRoom,
} from "@/lib/supabase/live-world";

export function LiveWorldAdmin() {
  const { user, worldSupervisor, loading, openAuth } = useAuth();
  const [name, setName] = useState("Live World Session");
  const [duration, setDuration] = useState(10);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<CreatedLiveWorldRoom | null>(null);
  const [rooms, setRooms] = useState<Awaited<ReturnType<typeof listLiveWorldRoomsForAdmin>>>([]);

  const refresh = useCallback(async () => {
    if (!worldSupervisor) return;
    try { setRooms(await listLiveWorldRoomsForAdmin()); } catch (caught) { setError(caught instanceof Error ? caught.message : "Live World rooms could not be loaded."); }
  }, [worldSupervisor]);
  useEffect(() => { queueMicrotask(() => { void refresh(); }); }, [refresh]);

  async function create(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try { const next = await createLiveWorldRoom(name, duration * 60); setCreated(next); await refresh(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "The Live World room could not be created."); }
    finally { setBusy(false); }
  }
  async function copy(value: string) { await navigator.clipboard?.writeText(value); }

  if (loading) return <main className="mx-auto max-w-6xl px-5 py-12"><p className="text-sm text-[var(--ink-muted)]">Checking administrator access…</p></main>;
  if (!user) return <main className="mx-auto max-w-6xl px-5 py-12"><Card className="max-w-xl p-7"><ShieldCheck className="text-[var(--accent)]" size={22} /><h1 className="mt-4 text-2xl font-bold">Platform administrator access</h1><p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">Sign in with a Platform Admin account to create and control Live World rooms.</p><Button className="mt-5" onClick={() => openAuth("sign-in")}>Sign in</Button></Card></main>;
  if (!worldSupervisor) return <main className="mx-auto max-w-6xl px-5 py-12"><Card className="max-w-xl p-7"><ShieldCheck className="text-[var(--red)]" size={22} /><h1 className="mt-4 text-2xl font-bold">Platform administrator access required</h1><p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">Only Platform Admins can create a short Live World event.</p></Card></main>;

  return <main className="mx-auto min-h-screen max-w-6xl px-5 py-12 sm:px-8"><header><p className="text-[10px] font-extrabold uppercase tracking-[.2em] text-[var(--accent)]">Platform administration</p><h1 className="mt-3 flex items-center gap-3 text-4xl font-bold tracking-[-.05em]"><Gamepad2 className="text-[var(--accent)]" /> Live World Rooms</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--ink-muted)]">Create a self-contained 12-player synchronous economic simulation. Player and administrator codes are generated once; save them before leaving this page.</p></header><div className="mt-8 grid gap-6 lg:grid-cols-[.85fr_1.15fr]"><Card className="p-6"><h2 className="text-xl font-bold">Create a room</h2><form className="mt-5 grid gap-5" onSubmit={(event) => void create(event)}><label className="grid gap-2 text-xs font-bold">Room name<input maxLength={120} value={name} onChange={(event) => setName(event.target.value)} className="h-10 rounded-lg border border-[var(--line)] bg-[var(--canvas)] px-3 text-sm" required /></label><label className="grid gap-2 text-xs font-bold">Duration<select value={duration} onChange={(event) => setDuration(Number(event.target.value))} className="h-10 rounded-lg border border-[var(--line)] bg-[var(--canvas)] px-3 text-sm">{[5, 10, 15, 20, 30, 45, 60].map((minutes) => <option key={minutes} value={minutes}>{minutes} minutes</option>)}</select></label>{error && <p role="alert" className="rounded-lg bg-[var(--red-soft)] p-3 text-xs text-[var(--red)]">{error}</p>}<Button type="submit" disabled={busy}>{busy && <LoaderCircle className="animate-spin" size={15} />}{busy ? "Creating…" : "Create Live World room"}</Button></form>{created && <section className="mt-6 rounded-xl border border-[var(--accent)] bg-[var(--accent-soft)] p-4"><p className="text-xs font-bold text-[var(--accent)]">Save these invitation codes now. They are not shown again.</p><Code label="Player code" value={created.playerCode} onCopy={copy} /><Code label="Administrator code" value={created.adminCode} onCopy={copy} /><div className="mt-4 flex flex-wrap gap-2"><Link href={`/live-world?room=${created.room.id}`} target="_blank" className="inline-flex h-9 items-center rounded-lg bg-[var(--accent)] px-3 text-xs font-bold text-white">Open room</Link><button type="button" onClick={() => void copy(`${window.location.origin}/live-world?room=${created.room.id}`)} className="inline-flex h-9 items-center gap-2 rounded-lg border border-[var(--accent)] px-3 text-xs font-bold text-[var(--accent)]"><Copy size={13} /> Copy room link</button></div></section>}</Card><section><div className="flex items-center justify-between"><h2 className="text-xl font-bold">Existing rooms</h2><Button size="sm" variant="secondary" onClick={() => void refresh()}>Refresh</Button></div><div className="mt-4 grid gap-3">{rooms.map((room) => <Card key={room.id} className="p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.12em] text-[var(--accent)]">{room.status}</p><h3 className="mt-1 text-lg font-bold">{room.name}</h3><p className="mt-1 text-xs text-[var(--ink-muted)]">{Math.round(room.duration_seconds / 60)} minutes · {room.participant_count} people entered</p></div><Link href={`/live-world?room=${room.id}`} target="_blank" className="rounded-lg border border-[var(--line)] px-3 py-2 text-xs font-bold text-[var(--accent)]">Open control room</Link></div></Card>)}{!rooms.length && <Card className="p-6 text-sm text-[var(--ink-muted)]">No Live World rooms have been created yet.</Card>}</div></section></div></main>;
}

function Code({ label, value, onCopy }: { label: string; value: string; onCopy: (value: string) => Promise<void> }) {
  return <div className="mt-3"><p className="text-[10px] font-extrabold uppercase tracking-[.14em] text-[var(--ink-faint)]">{label}</p><div className="mt-1 flex items-center justify-between gap-2 rounded-lg border border-[var(--line)] bg-[var(--canvas)] px-3 py-2"><code className="text-sm font-bold tracking-wide">{value}</code><button type="button" aria-label={`Copy ${label}`} onClick={() => void onCopy(value)} className="text-[var(--accent)]"><Copy size={14} /></button></div></div>;
}
