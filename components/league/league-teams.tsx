"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowRight, Building2, Globe2, LoaderCircle, Plus, Trophy, UsersRound } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { Team, TeamMember } from "@/lib/league/types";
import { createLeagueTeam, getLeagueContext, listSchoolTeams } from "@/lib/supabase/league";
import type { PublicLeagueTeam } from "@/lib/supabase/league-directory";
import { listPublicLeagueTeams } from "@/lib/supabase/league-directory";
import { listSubmittedChallengeAttemptCounts } from "@/lib/supabase/league-challenges";

type TeamWithMembers = Team & { members: TeamMember[] };

export function LeagueTeams() {
  const { user, openAuth } = useAuth();
  const [schoolName, setSchoolName] = useState<string | null>(null);
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [teams, setTeams] = useState<TeamWithMembers[]>([]);
  const [publicTeams, setPublicTeams] = useState<PublicLeagueTeam[]>([]);
  const [attemptCounts, setAttemptCounts] = useState<Record<string, number>>({});
  const [canManage, setCanManage] = useState(false);
  const [privateLoading, setPrivateLoading] = useState(true);
  const [publicLoading, setPublicLoading] = useState(true);
  const [error, setError] = useState("");

  const loadPublic = useCallback(async () => {
    try { setPublicTeams(await listPublicLeagueTeams()); } catch { setPublicTeams([]); } finally { setPublicLoading(false); }
  }, []);
  const loadPrivate = useCallback(async () => {
    if (!user) { setPrivateLoading(false); return; }
    try {
      const context = await getLeagueContext(user.id);
      setSchoolName(context.school?.name ?? null);
      setSchoolId(context.school?.id ?? null);
      setCanManage(context.profile?.platform_role === "school_leader" || context.profile?.platform_role === "platform_admin");
      if (!context.school?.id) return;
      const listed = await listSchoolTeams(context.school.id);
      setTeams(listed);
      setAttemptCounts(await listSubmittedChallengeAttemptCounts(listed.map((team) => team.id)));
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not load your school Teams."); } finally { setPrivateLoading(false); }
  }, [user]);

  useEffect(() => { queueMicrotask(() => { void loadPublic(); }); }, [loadPublic]);
  useEffect(() => { queueMicrotask(() => { void loadPrivate(); }); }, [loadPrivate]);

  async function createTeam() {
    if (!schoolId) return;
    const name = window.prompt("Team name");
    if (!name?.trim()) return;
    try { await createLeagueTeam({ schoolId, name: name.trim() }); await Promise.all([loadPrivate(), loadPublic()]); } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not create this Team."); }
  }

  return <main className="mx-auto min-h-screen max-w-[1440px] px-5 py-10 sm:px-8 lg:px-12"><header className="grid gap-7 border-b border-[var(--line)] pb-9 lg:grid-cols-[1.1fr_.9fr] lg:items-end"><div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-[var(--accent)]">EconMind League · competitive unit</p><h1 className="mt-2 text-5xl font-bold tracking-[-.07em] sm:text-6xl">Teams</h1><p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--ink-muted)]">Teams are the official unit for Challenges and standings. A school can maintain multiple Teams, and a Team’s highest official score determines its result for each Challenge.</p></div><Card className="p-5"><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[var(--accent)]">Participation</p><p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">Participants join an active Team with an invite code. School Leaders can create and manage Teams for their own school only.</p><Link href="/league/join" className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-[var(--accent)]">Join a Team <ArrowRight size={14} /></Link></Card></header>
    <section className="mt-10"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-[var(--accent)]">Public Team Directory</p><h2 className="mt-2 text-2xl font-bold">Active League Teams</h2></div><Link href="/league/standings" className="inline-flex items-center gap-2 text-sm font-bold text-[var(--accent)]">View standings <ArrowRight size={14} /></Link></div>{publicLoading ? <div className="grid min-h-48 place-items-center"><LoaderCircle className="animate-spin text-[var(--accent)]" /></div> : publicTeams.length ? <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{publicTeams.map((team) => <PublicTeamCard key={team.team_id} team={team} />)}</div> : <Card className="mt-6 p-6"><UsersRound className="text-[var(--accent)]" size={22} /><h3 className="mt-5 text-xl font-bold">Team profiles will appear here.</h3><p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--ink-muted)]">No approved school has published an active Team profile yet. Public cards list only a Team’s school, captain, aggregate results and current World country—not invite codes or private membership details.</p></Card>}</section>
    <section className="mt-12 border-t border-[var(--line)] pt-10"><div className="flex flex-wrap items-end justify-between gap-5"><div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-[var(--accent)]">My school workspace</p><h2 className="mt-2 text-2xl font-bold">{user ? schoolName ?? "Choose a school to begin" : "Sign in to manage your Team"}</h2></div>{user && canManage && <Button onClick={() => void createTeam()}><Plus size={15} /> Create Team</Button>}</div>{error && <p role="alert" className="mt-6 rounded-lg bg-[var(--red-soft)] p-4 text-sm text-[var(--red)]">{error}</p>}{!user ? <Card className="mt-6 p-7"><Building2 className="text-[var(--accent)]" size={22} /><h3 className="mt-5 text-xl font-bold">Your school and Team are private to your account.</h3><p className="mt-3 text-sm leading-6 text-[var(--ink-muted)]">Sign in to join a school Team, start an Official Challenge when Season 1 opens, or review your school’s existing Team workspace.</p><Button className="mt-6" onClick={() => openAuth("sign-in")}>Sign in</Button></Card> : privateLoading ? <div className="grid min-h-48 place-items-center"><LoaderCircle className="animate-spin text-[var(--accent)]" /></div> : teams.length ? <div className="mt-6 grid gap-5 md:grid-cols-2">{teams.map((team) => <PrivateTeamCard key={team.id} team={team} completed={attemptCounts[team.id] ?? 0} />)}</div> : <Card className="mt-6 p-7"><Building2 className="text-[var(--accent)]" size={22} /><h3 className="mt-5 text-xl font-bold">No Team yet</h3><p className="mt-3 text-sm leading-6 text-[var(--ink-muted)]">Use the League joining flow to select an existing school or request a new school. Once you have an active Team invite code, you can join it here.</p><Link href="/league/join" className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-[var(--accent)]">Open joining <ArrowRight size={14} /></Link></Card>}</section>
  </main>;
}

function PublicTeamCard({ team }: { team: PublicLeagueTeam }) {
  return <Card className="flex min-h-64 flex-col p-6"><div className="flex items-start justify-between gap-4"><span className="grid size-10 place-items-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent)]"><UsersRound size={19} /></span>{team.continuous_world_country && <span className="rounded-full bg-[var(--accent-soft)] px-2.5 py-1 text-[10px] font-bold text-[var(--accent)]">World: {team.continuous_world_country}</span>}</div><p className="mt-6 text-[10px] font-bold uppercase tracking-[.13em] text-[var(--accent)]">{team.school_name}</p><h3 className="mt-2 text-xl font-bold">{team.team_name}</h3><p className="mt-2 text-sm text-[var(--ink-muted)]">Captain: {team.captain_name ?? "To be announced"}</p><div className="mt-auto grid grid-cols-2 gap-3 border-t border-[var(--line)] pt-5 text-xs"><span><b className="block text-base text-[var(--ink)]">{team.member_count}</b> members</span><span><b className="block text-base text-[var(--ink)]">{team.current_season_points ? team.current_season_points.toFixed(1) : "—"}</b> season points</span></div></Card>;
}

function PrivateTeamCard({ team, completed }: { team: TeamWithMembers; completed: number }) {
  return <Card className="p-6"><div className="flex items-start justify-between gap-4"><span className="grid size-10 place-items-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent)]"><UsersRound size={19} /></span><span className="text-xs font-bold text-[var(--ink-muted)]">{completed} completed</span></div><h3 className="mt-7 text-2xl font-bold">{team.name}</h3><p className="mt-2 text-sm text-[var(--ink-muted)]">{team.members.length} member{team.members.length === 1 ? "" : "s"} · {team.status}</p><p className="mt-5 text-xs leading-5 text-[var(--ink-muted)]">Season 1 Official Challenges are coming soon. Practice remains available from each Challenge briefing.</p><div className="mt-6 flex flex-wrap gap-4"><Link href="/league/season" className="inline-flex items-center gap-2 text-sm font-bold text-[var(--accent)]"><Trophy size={14} /> Season details</Link><Link href="/league/world" className="inline-flex items-center gap-2 text-sm font-bold text-[var(--accent)]"><Globe2 size={14} /> Continuous World</Link></div></Card>;
}
