"use client";

import Link from "next/link";
import { Copy, Crown, LoaderCircle, LogOut, RefreshCw, UserMinus, UsersRound } from "lucide-react";
import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  applyToSeason1TeamByCode, getSeason1MyTeam, leaveSeason1Team,
  removeSeason1TeamMember, setSeason1Readiness,
  subscribeToSeason1Lobby, unsubscribeSeason1Lobby, type Season1MyTeamData,
} from "@/lib/supabase/season1";

export function Season1MyTeam() {
  const { user, loading: authLoading, roleLoading, openAuth } = useAuth();
  const [data, setData] = useState<Season1MyTeamData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [code, setCode] = useState("");
  const request = useRef(0);

  const refresh = useCallback(async () => {
    const current = ++request.current;
    try {
      const next = await getSeason1MyTeam();
      if (current !== request.current) return;
      setData(next);
      setError("");
    } catch (caught) {
      if (current !== request.current) return;
      // Do not leave a stale private roster on screen after access is revoked.
      setData(null);
      setError(caught instanceof Error ? caught.message : "Your team could not be loaded.");
    } finally {
      if (current === request.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading || roleLoading || !user) return;
    const initial = window.setTimeout(() => void refresh(), 0);
    // Polling also covers DELETE events not delivered after membership is lost.
    const interval = window.setInterval(() => void refresh(), 10_000);
    const channel = subscribeToSeason1Lobby(() => void refresh());
    const visible = () => { if (document.visibilityState === "visible") void refresh(); };
    document.addEventListener("visibilitychange", visible);
    return () => {
      request.current += 1;
      window.clearTimeout(initial);
      window.clearInterval(interval);
      unsubscribeSeason1Lobby(channel);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [authLoading, roleLoading, user, refresh]);

  async function act(action: () => Promise<unknown>, success: string) {
    if (busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await action();
      // Immediately clear old membership data before the authoritative reload.
      setData(null);
      await refresh();
      setMessage(success);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The team could not be updated.");
    } finally {
      setBusy(false);
    }
  }

  async function applyWithCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!code.trim()) return;
    await act(() => applyToSeason1TeamByCode(code), "Application sent. Your captain must approve it before you join the team.");
  }

  async function copyCode() {
    if (!data?.team) return;
    try {
      await navigator.clipboard.writeText(data.team.code);
      setMessage("Team code copied.");
    } catch {
      setMessage("Select and copy the team code shown above.");
    }
  }

  const team = data?.team;
  const captain = data?.membership?.memberRole === "captain" && team?.captainUserId === user?.id;
  const rosterLocked = Boolean(team && ["frozen", "dissolved", "registered", "active"].includes(team.status));

  return (
    <main className="mx-auto min-h-[70vh] max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
      <nav aria-label="Season 1" className="mb-8 flex flex-wrap items-center gap-3 text-sm font-bold">
        <Link href="/season1" className="rounded-lg border border-[var(--line)] px-4 py-2 hover:bg-[var(--surface-subtle)]">Season 1 Lobby</Link>
        <Link href="/season1/my-team" aria-current="page" className="rounded-lg bg-[var(--accent-soft)] px-4 py-2 text-[var(--accent)]">My Team</Link>
      </nav>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.2em] text-[var(--accent)]">Season 1 · Your home base</p>
          <h1 className="mt-3 text-4xl font-bold tracking-[-.04em] sm:text-5xl">My Team</h1>
          <p className="mt-3 text-[var(--ink-muted)]">Your team code, people and readiness — in one place.</p>
        </div>
        {user && <Button variant="secondary" disabled={busy || loading} onClick={() => void refresh()}><RefreshCw size={16} /> Refresh</Button>}
      </div>
      {error && <p role="alert" className="mb-5 rounded-xl border border-red-400/40 bg-red-500/10 p-4 text-sm text-red-600 dark:text-red-300">{error}</p>}
      {message && <p role="status" className="mb-5 rounded-xl border border-[var(--line)] bg-[var(--accent-soft)] p-4 text-sm text-[var(--accent)]">{message}</p>}
      {authLoading || roleLoading ? <p role="status">Checking account…</p> : !user ? (
        <Card className="p-8"><h2 className="text-xl font-bold">Sign in to view your team.</h2><Button className="mt-5" onClick={() => openAuth("sign-in")}>Sign in</Button></Card>
      ) : loading || busy && !data ? <p role="status" className="flex items-center gap-2"><LoaderCircle size={18} className="animate-spin" /> Loading your team…</p> : !data ? (
        <Button onClick={() => void refresh()}>Try again</Button>
      ) : !team ? (
        <Card className="max-w-2xl p-6 sm:p-8">
          <UsersRound size={30} className="text-[var(--accent)]" />
          <h2 className="mt-4 text-2xl font-bold">You have not joined a team yet.</h2>
          <p className="mt-3 leading-7 text-[var(--ink-muted)]">Create or discover a team in the Lobby. Each team has room for six members, including the captain.</p>
          <Link href="/season1/#discover" className="mt-5 inline-block font-bold text-[var(--accent)]">Create or find a team →</Link>
          <form onSubmit={(event) => void applyWithCode(event)} className="mt-7 border-t border-[var(--line)] pt-6">
            <label htmlFor="season1-team-code" className="text-sm font-bold">Already have a team code?</label>
            <div className="mt-3 flex flex-wrap gap-3">
              <input id="season1-team-code" required maxLength={32} autoCapitalize="characters" autoComplete="off" value={code} onChange={(event) => setCode(event.target.value)} placeholder="EM-T1-…" className="min-w-0 flex-1 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 uppercase" />
              <Button type="submit" disabled={busy || !code.trim()}>Apply with code</Button>
            </div>
            <p className="mt-2 text-xs leading-5 text-[var(--ink-muted)]">The captain approves applications. Invite-only teams require a personal invitation.</p>
          </form>
        </Card>
      ) : <>
        <Card className="p-6 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[.18em] text-[var(--accent)]">{captain ? "Captain workspace" : "Team member"}</p>
              <h2 className="mt-2 break-words text-3xl font-bold">{team.name}</h2>
              <p className="mt-3 max-w-2xl whitespace-pre-wrap text-sm leading-6 text-[var(--ink-muted)]">{team.description || "Your Season 1 team."}</p>
            </div>
            <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-subtle)] p-4">
              <p className="text-xs font-bold uppercase tracking-widest text-[var(--ink-muted)]">Team code</p>
              <p className="mt-2 select-all break-all font-mono text-lg font-bold text-[var(--accent)]">{team.code}</p>
              <Button size="sm" variant="secondary" className="mt-3" onClick={() => void copyCode()}><Copy size={14} /> Copy code</Button>
            </div>
          </div>
          <dl className="mt-7 grid grid-cols-2 gap-4 border-t border-[var(--line)] pt-6 sm:grid-cols-4">
            {[["Members", `${data.members.length} / ${team.capacity}`], ["Ready", `${data.members.filter((member) => member.isReady).length} / ${data.members.length}`], ["Language", team.preferredLanguage], ["Status", team.status]].map(([label, value]) => <div key={label}><dt className="text-xs text-[var(--ink-muted)]">{label}</dt><dd className="mt-1 text-lg font-bold capitalize">{value}</dd></div>)}
          </dl>
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <Button variant="secondary" disabled={busy || rosterLocked} onClick={() => void act(() => setSeason1Readiness(!data.membership?.isReady), "Readiness updated.")}>{data.membership?.isReady ? "Mark not ready" : "Mark ready"}</Button>
            <Link href="/season1/#team-room" className="text-sm font-bold text-[var(--accent)]">Team chat & applications →</Link>
          </div>
        </Card>
        <Card className="mt-6 p-6 sm:p-8">
          <h2 className="text-2xl font-bold">Team members</h2>
          <div className="mt-5 divide-y divide-[var(--line)]">
            {data.members.map((member) => <article key={member.userId} className="flex flex-wrap items-center justify-between gap-4 py-5">
              <div className="min-w-0">
                <h3 className="flex flex-wrap items-center gap-2 font-bold">{member.memberRole === "captain" && <Crown size={17} className="text-[var(--accent)]" />}{member.displayName}{member.userId === user.id && <span className="text-xs text-[var(--ink-muted)]">(You)</span>}</h3>
                <p className="mt-1 text-sm text-[var(--ink-muted)]">{member.schoolName || "Independent / no school affiliation"}</p>
                <p className="mt-2 text-xs text-[var(--ink-muted)]">{member.memberRole === "captain" ? "Captain" : "Member"} · {member.isReady ? "Ready" : "Not ready"}</p>
                {member.rolePreferences.length > 0 && <p className="mt-2 text-xs leading-5">{member.rolePreferences.join(" · ")}</p>}
              </div>
              {captain && member.memberRole !== "captain" && member.userId !== user.id && <Button size="sm" variant="secondary" disabled={busy || rosterLocked} onClick={() => {
                if (window.confirm(`Remove ${member.displayName} from ${team.name}? They will lose access to this team's chat.`)) void act(() => removeSeason1TeamMember(team.id, member.userId), "Member removed.");
              }}><UserMinus size={14} /> Remove</Button>}
            </article>)}
          </div>
          {rosterLocked ? <p className="mt-4 text-sm text-[var(--ink-muted)]">This team roster is locked for its current season status.</p> : captain ? <p className="mt-4 text-sm text-[var(--ink-muted)]">As captain, you can remove members. You cannot leave your own team without a leadership handover.</p> : <Button variant="secondary" className="mt-6" disabled={busy} onClick={() => {
            if (window.confirm(`Leave ${team.name}? You will lose access to its team chat and must apply again to rejoin.`)) void act(() => leaveSeason1Team(team.id), "You have left the team. You can now join or create another team.");
          }}><LogOut size={16} /> Leave team</Button>}
        </Card>
      </>}
    </main>
  );
}
