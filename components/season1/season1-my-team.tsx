"use client";

import Link from "next/link";
import { ArrowRight, Check, Copy, Crown, LoaderCircle, LogOut, MessageCircle, RefreshCw, Send, ShieldCheck, UserMinus, UsersRound, X } from "lucide-react";
import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Season1WorldArtwork } from "./season1-world-artwork";
import {
  applyToSeason1TeamByCode, getSeason1TeamWorkspace, leaveSeason1Team,
  removeSeason1TeamMember, setSeason1Readiness,
  postSeason1TeamMessage, reviewSeason1Application, setSeason1Preferences,
  subscribeToSeason1Lobby, unsubscribeSeason1Lobby, type Season1TeamWorkspaceData,
} from "@/lib/supabase/season1";

export function Season1MyTeam() {
  const { user, loading: authLoading, roleLoading, openAuth } = useAuth();
  const [data, setData] = useState<Season1TeamWorkspaceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [code, setCode] = useState("");
  const [draft, setDraft] = useState("");
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const draftTeam = useRef<string | null>(null);
  const request = useRef(0);

  const refresh = useCallback(async () => {
    const current = ++request.current;
    try {
      const next = await getSeason1TeamWorkspace();
      if (current !== request.current) return;
      if (draftTeam.current !== (next.team?.id ?? null)) setDraft("");
      draftTeam.current = next.team?.id ?? null;
      setData(next);
      setLoadedFor(user?.id ?? null);
      setError("");
    } catch (caught) {
      if (current !== request.current) return;
      // Do not leave a stale private roster on screen after access is revoked.
      setData(null);
      setDraft("");
      setError(caught instanceof Error ? caught.message : "Your team could not be loaded.");
    } finally {
      if (current === request.current) setLoading(false);
    }
  }, [user]);

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

  async function act(action: () => Promise<unknown>, success: string, clearMembership = false) {
    if (busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await action();
      // Immediately clear old membership data before the authoritative reload.
      if (clearMembership) { setData(null); setDraft(""); }
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

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!team || !draft.trim()) return;
    await act(async () => {
      await postSeason1TeamMessage(team.id, draft.trim());
      setDraft("");
    }, "Message sent.");
  }

  function moveSpotlight(event: React.PointerEvent<HTMLElement>) {
    if (event.pointerType === "touch") return;
    const bounds = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty("--spot-x", `${event.clientX - bounds.left}px`);
    event.currentTarget.style.setProperty("--spot-y", `${event.clientY - bounds.top}px`);
  }

  return (
    <main className="season1-lobby min-h-screen px-5 py-8 sm:px-8 lg:px-12" onPointerMove={moveSpotlight}>
      <nav aria-label="Season 1" className="mb-8 flex flex-wrap items-center gap-3 text-sm font-bold">
        <Link href="/season1" className="rounded-lg border border-[var(--line)] px-4 py-2 hover:bg-[var(--surface-subtle)]">Season 1 Lobby</Link>
        <Link href="/season1/my-team" aria-current="page" className="rounded-lg bg-[var(--accent-soft)] px-4 py-2 text-[var(--accent)]">My Team</Link>
      </nav>
      <section className="season1-world-hero relative isolate overflow-hidden rounded-2xl border border-[#2b6f68] px-6 py-10 text-white shadow-2xl sm:px-10 sm:py-14">
        <Season1WorldArtwork />
        <div className="relative z-10 flex min-h-[34rem] flex-col justify-center gap-10 lg:min-h-[37rem]">
          <div className="season1-world-copy">
            <p className="season1-eyebrow"><span className="season1-live-pip" /> Season 1 / Your home base</p>
            <h1 className="mt-4 max-w-3xl text-5xl font-bold tracking-[-.075em] sm:text-6xl lg:text-7xl">My Team.<br /><em>Build together.</em></h1>
            <p className="mt-6 max-w-2xl text-sm leading-7 text-white/72 sm:text-base">Your dedicated team workspace. Manage your roster, share your team code, talk privately and prepare for Season 1.</p>
            <div className="season1-hero-actions mt-8 flex flex-wrap gap-3">
              <a href="#team-overview" className="inline-flex h-10 items-center gap-2 rounded-lg border border-white/25 bg-white/10 px-4 text-sm font-semibold text-white transition hover:bg-white/18">Open workspace <ArrowRight size={16} /></a>
              {user && <Button variant="secondary" disabled={busy || loading} onClick={() => void refresh()}><RefreshCw size={16} /> Refresh</Button>}
            </div>
          </div>
        </div>
      </section>
      <nav className="season1-portals" aria-label="My Team workspace">
        <a href="#team-overview"><span className="season1-portal-icon"><UsersRound size={22} /></span><span><small>01 / YOUR PEOPLE</small><strong>Team & Members</strong><span>Code, roster and readiness.</span></span><ArrowRight size={18} /></a>
        <a href="#team-chat"><span className="season1-portal-icon"><MessageCircle size={22} /></span><span><small>02 / TEAM ROOM</small><strong>Private Chat</strong><span>Plan your next move together.</span></span><ArrowRight size={18} /></a>
        <a href="#team-applications"><span className="season1-portal-icon"><ShieldCheck size={22} /></span><span><small>03 / RECRUITMENT</small><strong>Applications</strong><span>Review requests to join.</span></span><ArrowRight size={18} /></a>
      </nav>
      <section id="team-overview" className="season1-chapter py-10">
      {error && <p role="alert" className="mb-5 rounded-xl border border-red-400/40 bg-red-500/10 p-4 text-sm text-red-600 dark:text-red-300">{error}</p>}
      {message && <p role="status" className="mb-5 rounded-xl border border-[var(--line)] bg-[var(--accent-soft)] p-4 text-sm text-[var(--accent)]">{message}</p>}
      {authLoading || roleLoading ? <p role="status">Checking account…</p> : !user ? (
        <Card className="p-8"><h2 className="text-xl font-bold">Sign in to view your team.</h2><Button className="mt-5" onClick={() => openAuth("sign-in")}>Sign in</Button></Card>
      ) : loading || busy && !data || data && loadedFor !== user.id ? <p role="status" className="flex items-center gap-2"><LoaderCircle size={18} className="animate-spin" /> Loading your team…</p> : !data ? (
        <Button onClick={() => void refresh()}>Try again</Button>
      ) : !team ? (
        <Card className="season1-room-card p-6 sm:p-8">
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
        <Card className="season1-room-card p-6 sm:p-8">
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
            <a href="#team-chat" className="text-sm font-bold text-[var(--accent)]">Go to team chat →</a>
          </div>
        </Card>
        <Card className="season1-room-card mt-6 p-6 sm:p-8">
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
                if (window.confirm(`Remove ${member.displayName} from ${team.name}? They will lose access to this team's chat.`)) void act(() => removeSeason1TeamMember(team.id, member.userId), "Member removed.", true);
              }}><UserMinus size={14} /> Remove</Button>}
            </article>)}
          </div>
          {rosterLocked ? <p className="mt-4 text-sm text-[var(--ink-muted)]">This team roster is locked for its current season status.</p> : captain ? <p className="mt-4 text-sm text-[var(--ink-muted)]">As captain, you can remove members. You cannot leave your own team without a leadership handover.</p> : <Button variant="secondary" className="mt-6" disabled={busy} onClick={() => {
            if (window.confirm(`Leave ${team.name}? You will lose access to its team chat and must apply again to rejoin.`)) void act(() => leaveSeason1Team(team.id), "You have left the team. You can now join or create another team.", true);
          }}><LogOut size={16} /> Leave team</Button>}
          <div className="mt-8 border-t border-[var(--line)] pt-6">
            <h3 className="font-bold">Your role preferences</h3>
            <p className="mt-2 text-sm text-[var(--ink-muted)]">Signal your interests. These preferences do not assign a permanent office.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {data.roles.map((role) => {
                const preferences = data.members.find((member) => member.userId === user.id)?.rolePreferences ?? [];
                const selected = preferences.includes(role);
                return <button key={role} type="button" disabled={busy || rosterLocked} aria-pressed={selected} onClick={() => void act(() => setSeason1Preferences(selected ? preferences.filter((item) => item !== role) : [...preferences, role]), "Role preferences updated.")} className={`rounded-full border px-4 py-2 text-sm disabled:opacity-50 ${selected ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]" : "border-[var(--line)] text-[var(--ink-muted)]"}`}>{role}</button>;
              })}
            </div>
          </div>
        </Card>
      </>}
      </section>
      {user && !authLoading && !roleLoading && loadedFor === user.id && data && <>
        <section id="team-chat" className="season1-chapter border-b border-[var(--line)] py-10">
          <Card className="season1-room-card p-6 sm:p-8">
            <p className="text-xs font-bold uppercase tracking-[.18em] text-[var(--accent)]">Team Room / Private conversation</p>
            <h2 className="mt-3 text-3xl">Team Chat</h2>
            <p className="mt-3 text-sm text-[var(--ink-muted)]">{team ? "Only current team members can read and post here." : "Join a team to unlock its private conversation."}</p>
            {team && <>
              <ol aria-label="Team messages" className="mt-6 grid max-h-[32rem] min-h-40 gap-4 overflow-y-auto rounded-xl border border-[var(--line)] bg-[var(--surface-subtle)] p-4 sm:p-6">
                {!data.messages.length && <li className="self-center text-center text-sm text-[var(--ink-muted)]">No messages yet. Start the conversation with your team.</li>}
                {data.messages.map((item) => <li key={item.id} className="min-w-0">
                  <p className="text-xs font-bold text-[var(--accent)]">{item.authorName} <time dateTime={item.createdAt} className="ml-2 font-normal text-[var(--ink-faint)]">{new Date(item.createdAt).toLocaleString()}</time></p>
                  <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-7">{item.deletedAt ? "Message deleted." : item.content}</p>
                </li>)}
              </ol>
              <form onSubmit={(event) => void sendMessage(event)} className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end">
                <label className="min-w-0 flex-1 text-xs font-bold">Message your team<textarea value={draft} onChange={(event) => setDraft(event.target.value)} disabled={busy} required maxLength={1000} rows={3} placeholder="Write a message" className="mt-2 block w-full resize-y rounded-xl border border-[var(--line)] p-4 text-sm font-normal" /></label>
                <Button type="submit" disabled={busy || !draft.trim()}><Send size={16} /> Send message</Button>
              </form>
            </>}
          </Card>
        </section>
        <section id="team-applications" className="season1-chapter py-10">
          <Card className="season1-room-card p-6 sm:p-8">
            <p className="text-xs font-bold uppercase tracking-[.18em] text-[var(--accent)]">Recruitment / Application activity</p>
            <h2 className="mt-3 text-3xl">{captain ? "Review team applications" : "Applications"}</h2>
            <p className="mt-3 text-sm text-[var(--ink-muted)]">{captain ? "Approve or decline requests to join your team. Six members maximum, including you." : "Applications require the team captain’s approval."}</p>
            <div className="mt-6 divide-y divide-[var(--line)] border-y border-[var(--line)]">
              {!data.applications.length && <p className="py-6 text-sm text-[var(--ink-muted)]">No pending applications.</p>}
              {data.applications.map((application) => <article key={application.id} className="flex flex-wrap items-center justify-between gap-4 py-5">
                <div><h3 className="font-bold">{application.applicantName}</h3><p className="mt-1 text-sm text-[var(--ink-muted)]">Applied to {application.teamName}</p>{application.note && <p className="mt-2 whitespace-pre-wrap break-words text-sm">{application.note}</p>}</div>
                {captain && application.teamId === team?.id ? <div className="flex gap-3">
                  <Button disabled={busy || rosterLocked || data.members.length >= team.capacity} onClick={() => void act(() => reviewSeason1Application(application.id, true), "Application accepted.")}><Check size={16} /> Accept</Button>
                  <Button variant="secondary" disabled={busy || rosterLocked} onClick={() => { if (window.confirm(`Decline ${application.applicantName}'s application?`)) void act(() => reviewSeason1Application(application.id, false), "Application declined."); }}><X size={16} /> Decline</Button>
                </div> : <span className="text-sm text-[var(--ink-muted)]">Pending</span>}
              </article>)}
            </div>
          </Card>
        </section>
      </>}
    </main>
  );
}
