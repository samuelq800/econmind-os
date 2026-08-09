"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowRight, Building2, LoaderCircle, Plus, UsersRound } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { Team, TeamMember } from "@/lib/league/types";
import { createLeagueTeam, getLeagueContext, listSchoolTeams } from "@/lib/supabase/league";
import { listMyChallengeAttempts } from "@/lib/supabase/league-challenges";

type TeamWithMembers = Team & { members: TeamMember[] };

export function LeagueTeams() {
  const { user, openAuth } = useAuth();
  const [schoolName, setSchoolName] = useState<string | null>(null);
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [teams, setTeams] = useState<TeamWithMembers[]>([]);
  const [attemptCounts, setAttemptCounts] = useState<Record<string, number>>({});
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => { if (!user) { setLoading(false); return; } try { const context = await getLeagueContext(user.id); setSchoolName(context.school?.name ?? null); setSchoolId(context.school?.id ?? null); setCanManage(context.profile?.platform_role === "school_leader" || context.profile?.platform_role === "platform_admin"); if (!context.school?.id) return; const listed = await listSchoolTeams(context.school.id); setTeams(listed); const counts = await Promise.all(listed.map(async (team) => [team.id, (await listMyChallengeAttempts(team.id)).filter((attempt) => attempt.status === "submitted").length] as const)); setAttemptCounts(Object.fromEntries(counts)); } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not load teams."); } finally { setLoading(false); } }, [user]);
  useEffect(() => { queueMicrotask(() => { void load(); }); }, [load]);
  async function createTeam() { if (!schoolId) return; const name = window.prompt("Team name"); if (!name?.trim()) return; try { await createLeagueTeam({ schoolId, name: name.trim() }); await load(); } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not create this Team."); } }
  if (!user) return <main className="mx-auto min-h-[60vh] max-w-4xl px-5 py-16"><h1 className="text-4xl font-bold">My Teams</h1><p className="mt-4 text-[var(--ink-muted)]">Sign in to join a school Team, start an official Challenge or review saved work.</p><Button className="mt-6" onClick={() => openAuth("sign-in")}>Sign in</Button></main>;
  return <main className="mx-auto min-h-screen max-w-[1240px] px-5 py-10 sm:px-8 lg:px-12"><header className="flex flex-wrap items-end justify-between gap-5"><div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-[var(--accent)]">League organisation</p><h1 className="mt-2 text-4xl font-bold tracking-[-.06em]">My Teams</h1><p className="mt-3 text-sm leading-6 text-[var(--ink-muted)]">{schoolName ? `${schoolName} · each Team is independently ranked.` : "Choose a school and join a Team to begin."}</p></div>{canManage && <Button onClick={() => void createTeam()}><Plus size={15} /> Create team</Button>}</header>{error && <p role="alert" className="mt-6 rounded-lg bg-[var(--red-soft)] p-4 text-sm text-[var(--red)]">{error}</p>}{loading ? <div className="grid min-h-64 place-items-center"><LoaderCircle className="animate-spin text-[var(--accent)]" /></div> : teams.length ? <div className="mt-8 grid gap-5 md:grid-cols-2">{teams.map((team) => <Card key={team.id} className="p-6"><div className="flex items-start justify-between gap-4"><span className="grid size-10 place-items-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent)]"><UsersRound size={19} /></span><span className="text-xs font-bold text-[var(--ink-muted)]">{attemptCounts[team.id] ?? 0} completed</span></div><h2 className="mt-7 text-2xl font-bold">{team.name}</h2><p className="mt-2 text-sm text-[var(--ink-muted)]">{team.members.length} member{team.members.length === 1 ? "" : "s"} · {team.status}</p><p className="mt-5 text-xs leading-5 text-[var(--ink-muted)]">Members can hold multiple Challenge portfolios. School Leaders can create and manage Teams for their own school; RLS continues to protect other schools.</p><Link href="/league/arena" className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-[var(--accent)]">Open Challenges <ArrowRight size={14} /></Link></Card>)}</div> : <Card className="mt-8 p-7"><Building2 className="text-[var(--accent)]" size={22} /><h2 className="mt-5 text-xl font-bold">No school Team yet</h2><p className="mt-3 text-sm leading-6 text-[var(--ink-muted)]">Use the League joining flow to select an existing school or request a new one. Once admitted, you can join with an invite code. School Leaders can then create more teams for the same school.</p><Link href="/league/join" className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-[var(--accent)]">Open joining <ArrowRight size={14} /></Link></Card>}</main>;
}
