"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, BadgeCheck, ImagePlus, LoaderCircle, Pencil, UsersRound } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { SchoolDirectoryLedger } from "@/components/league/school-directory-ledger";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LEAGUE_ACHIEVEMENTS } from "@/lib/league/league-season";
import { participatingSchoolKey } from "@/lib/league/participating-schools";
import {
  mergeLeagueDirectory,
  withDirectorySyncTimeout,
  type LeagueDirectorySchool,
} from "@/lib/league/school-directory";
import { networkRegionForSchool } from "@/lib/league/school-network";
import { getLeagueContext } from "@/lib/supabase/league";
import type { PublicLeagueTeam } from "@/lib/supabase/league-directory";
import { listPublicLeagueSchools, listPublicLeagueTeams, updateLeagueSchoolProfile } from "@/lib/supabase/league-directory";

function normaliseName(name: string) {
  return participatingSchoolKey(name);
}

export function LeagueSchools({ profileName }: { profileName?: string | null }) {
  const { user } = useAuth();
  const [schools, setSchools] = useState<LeagueDirectorySchool[]>(() => mergeLeagueDirectory([]));
  const [publicTeams, setPublicTeams] = useState<PublicLeagueTeam[]>([]);
  const [syncStatus, setSyncStatus] = useState<"syncing" | "live" | "fallback">("syncing");
  const [teamsStatus, setTeamsStatus] = useState<"idle" | "syncing" | "live" | "fallback">(
    profileName ? "syncing" : "idle",
  );
  const [leaderSchoolId, setLeaderSchoolId] = useState<string | null>(null);
  const [canManage, setCanManage] = useState(false);
  const mounted = useRef(true);

  const load = useCallback(async () => {
    if (!mounted.current) return;
    setSyncStatus("syncing");
    try {
      const rows = await withDirectorySyncTimeout(listPublicLeagueSchools());
      if (!mounted.current) return;
      setSchools(mergeLeagueDirectory(rows));
      setSyncStatus("live");
    } catch {
      if (!mounted.current) return;
      // The static partner roster keeps the public League useful before the
      // optional directory migration has been applied.
      setSyncStatus("fallback");
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  useEffect(() => { queueMicrotask(() => { void load(); }); }, [load]);
  useEffect(() => {
    if (!profileName) return;
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      setTeamsStatus("syncing");
      void withDirectorySyncTimeout(listPublicLeagueTeams())
        .then((teams) => {
          if (!active) return;
          setPublicTeams(teams);
          setTeamsStatus("live");
        })
        .catch(() => {
          if (!active) return;
          setPublicTeams([]);
          setTeamsStatus("fallback");
        });
    });
    return () => { active = false; };
  }, [profileName]);
  useEffect(() => {
    if (!user) return;
    let active = true;
    void getLeagueContext(user.id).then((context) => {
      if (!active) return;
      setLeaderSchoolId(context.school?.id ?? null);
      setCanManage(context.profile?.platform_role === "school_leader" || context.profile?.platform_role === "platform_admin");
    }).catch(() => undefined);
    return () => { active = false; };
  }, [user]);

  const requested = profileName || null;
  const selected = requested ? schools.find((school) => normaliseName(school.school_name) === normaliseName(requested)) ?? null : null;
  const selectedTeams = selected ? publicTeams.filter((team) => team.school_id === selected.school_id || normaliseName(team.school_name) === normaliseName(selected.school_name)) : [];

  if (profileName) {
    return <SchoolProfile school={selected} teams={selectedTeams} teamsStatus={teamsStatus} canManage={Boolean(selected && canManage && selected.school_id === leaderSchoolId)} refresh={load} syncing={syncStatus === "syncing"} />;
  }

  return <main className="mx-auto min-h-screen max-w-[1440px] px-5 py-10 sm:px-8 lg:px-12"><header className="grid gap-7 border-b border-[var(--line)] pb-9 lg:grid-cols-[1.1fr_.9fr] lg:items-end"><div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-[var(--accent)]">EconMind League · partner network</p><h1 className="mt-2 text-5xl font-bold tracking-[-.07em] sm:text-6xl">Schools</h1><p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--ink-muted)]">Each school is a public League identity. Teams compete independently, while School Leaders manage their own school profile and team structure.</p></div><Card className="p-5"><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[var(--accent)]">Directory access</p><p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">School names, public Team counts and official aggregate results are visible here. Membership, invite codes and strategy data remain private.</p></Card></header><section className="mt-10"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-[var(--accent)]">Participating schools</p><h2 className="mt-2 text-2xl font-bold">{schools.length} schools in the public network</h2><p className="mt-2 text-xs text-[var(--ink-faint)]" role="status" aria-live="polite">{syncStatus === "syncing" && "Checking live profiles…"}{syncStatus === "live" && "Live directory checked."}{syncStatus === "fallback" && "Live sync unavailable; verified roster shown."}</p></div><Link href="/league/join" className="inline-flex items-center gap-2 text-sm font-bold text-[var(--accent)]">Join your school <ArrowRight size={14} /></Link></div><div className="mt-6 overflow-hidden rounded-2xl border border-[var(--line-strong)] shadow-[var(--shadow)]"><SchoolDirectoryLedger schools={schools} /></div></section></main>;
}

export function LeagueSchoolProfile() {
  const searchParams = useSearchParams();
  return <LeagueSchools profileName={searchParams?.get("school") ?? null} />;
}

function SchoolProfile({ school, teams, teamsStatus, canManage, refresh, syncing }: { school: LeagueDirectorySchool | null; teams: PublicLeagueTeam[]; teamsStatus: "idle" | "syncing" | "live" | "fallback"; canManage: boolean; refresh: () => Promise<void>; syncing: boolean }) {
  const [editing, setEditing] = useState(false);
  const [description, setDescription] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function save() {
    if (!school || school.isEditorialOnly) return;
    setSaving(true); setError("");
    try {
      await updateLeagueSchoolProfile({ schoolId: school.school_id, description, logoUrl: logoUrl.trim() || null });
      await refresh();
      setEditing(false);
      setMessage("School profile updated.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update the school profile.");
    } finally { setSaving(false); }
  }

  function toggleEditing() {
    if (editing) { setEditing(false); return; }
    setDescription(school?.description ?? "");
    setLogoUrl(school?.logo_url ?? "");
    setEditing(true);
  }

  if (!school && syncing) return <main className="grid min-h-[60vh] place-items-center"><LoaderCircle className="animate-spin text-[var(--accent)]" /></main>;
  if (!school) return <main className="mx-auto min-h-[60vh] max-w-4xl px-5 py-16"><Link href="/league/schools" className="inline-flex items-center gap-2 text-sm font-bold text-[var(--accent)]"><ArrowLeft size={14} /> All schools</Link><h1 className="mt-8 text-4xl font-bold">School not found</h1><p className="mt-4 text-[var(--ink-muted)]">This public profile is not in the League directory.</p></main>;

  const noPublishedData = school.team_count === 0 && school.member_count === 0 && school.official_challenge_count === 0;
  const networkRegion = networkRegionForSchool(school);
  return <main className="mx-auto min-h-screen max-w-[1240px] px-5 py-10 sm:px-8 lg:px-12"><Link href="/league/schools" className="inline-flex items-center gap-2 text-sm font-bold text-[var(--accent)]"><ArrowLeft size={14} /> Schools</Link><header className="mt-8 grid gap-7 border-b border-[var(--line)] pb-9 md:grid-cols-[auto_1fr_auto] md:items-start"><SchoolMark school={school} large /><div><p className="text-[10px] font-bold uppercase tracking-[.17em] text-[var(--accent)]">{school.city ?? "League partner"} · {networkRegion ?? "Location pending"}</p><h1 className="mt-2 text-4xl font-bold tracking-[-.06em] sm:text-5xl">{school.school_name}</h1><p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--ink-muted)]">{school.description ?? school.club_name ?? "This partner school is part of the EconMind League public network."}</p></div>{canManage && <Button variant="secondary" onClick={toggleEditing}><Pencil size={15} /> {editing ? "Cancel editing" : "Edit school profile"}</Button>}</header>{message && <p className="mt-5 rounded-lg bg-[var(--accent-soft)] p-4 text-sm text-[var(--accent)]">{message}</p>}{error && <p role="alert" className="mt-5 rounded-lg bg-[var(--red-soft)] p-4 text-sm text-[var(--red)]">{error}</p>}{editing && <Card className="mt-7 p-6"><div className="flex items-start gap-3"><ImagePlus className="mt-0.5 text-[var(--accent)]" size={18} /><div><h2 className="font-bold">School profile</h2><p className="mt-1 text-sm text-[var(--ink-muted)]">This public description and logo link are only editable by your School Leader.</p></div></div><label className="mt-5 block text-sm font-bold">Description<textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={1200} className="mt-2 min-h-28 w-full rounded-lg border border-[var(--line)] bg-[var(--surface-subtle)] p-3 font-normal outline-none focus:border-[var(--accent)]" /></label><label className="mt-4 block text-sm font-bold">Logo URL <span className="font-normal text-[var(--ink-muted)]">(optional, https://)</span><input value={logoUrl} onChange={(event) => setLogoUrl(event.target.value)} className="mt-2 h-10 w-full rounded-lg border border-[var(--line)] bg-[var(--surface-subtle)] px-3 font-normal outline-none focus:border-[var(--accent)]" placeholder="https://…" /></label><Button className="mt-5" onClick={() => void save()} disabled={saving}>{saving ? "Saving…" : "Save school profile"}</Button></Card>}
    <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><Stat label="Members" value={school.member_count || "—"} /><Stat label="Active teams" value={school.team_count || "—"} /><Stat label="Season points" value={school.current_season_points ? school.current_season_points.toFixed(1) : "—"} /><Stat label="Official challenges" value={school.official_challenge_count || "—"} /></section>
    <section className="mt-8 grid gap-5 lg:grid-cols-2"><Card className="p-6"><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[var(--accent)]">Achievements</p><h2 className="mt-2 text-xl font-bold">Official milestones</h2><div className="mt-5 flex flex-wrap gap-2">{school.achievements.length ? school.achievements.map((achievement) => <Badge key={achievement} className="border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"><BadgeCheck size={13} /> {achievement}</Badge>) : LEAGUE_ACHIEVEMENTS.map((achievement) => <span key={achievement} className="rounded-full border border-[var(--line)] px-3 py-1.5 text-xs text-[var(--ink-muted)]">{achievement} · pending</span>)}</div><p className="mt-5 text-sm leading-6 text-[var(--ink-muted)]">Badges are awarded automatically from published official results. No manual school-score adjustment is available.</p></Card><Card className="p-6"><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[var(--accent)]">Official history</p><h2 className="mt-2 text-xl font-bold">Season record</h2><p className="mt-5 text-sm leading-6 text-[var(--ink-muted)]">{noPublishedData ? "No official season result has been published for this school. Season 1 is currently preparing." : `${school.official_challenge_count} official challenge result${school.official_challenge_count === 1 ? "" : "s"} contribute to this public school summary.`}</p><Link href="/league/standings" className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-[var(--accent)]">View standings <ArrowRight size={14} /></Link></Card></section>
    <Card className="mt-5 p-6"><div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[var(--accent)]">Current active teams</p><h2 className="mt-2 text-xl font-bold">Team directory</h2><p className="mt-3 text-sm leading-6 text-[var(--ink-muted)]">Public active Teams show their captain and aggregate League record. Private membership details and invite codes remain visible only to authorised school users.</p></div><UsersRound className="text-[var(--accent)]" size={22} /></div>{teamsStatus === "syncing" || teamsStatus === "idle" ? <p className="mt-5 rounded-lg bg-[var(--surface-subtle)] p-4 text-sm leading-6 text-[var(--ink-muted)]" role="status">Checking published Team profiles…</p> : teamsStatus === "fallback" ? <p className="mt-5 rounded-lg bg-[var(--surface-subtle)] p-4 text-sm leading-6 text-[var(--ink-muted)]" role="status">Team profiles are temporarily unavailable. The school profile remains accessible.</p> : teams.length ? <div className="mt-5 grid gap-3 sm:grid-cols-2">{teams.map((team) => <div key={team.team_id} className="rounded-lg bg-[var(--surface-subtle)] p-4"><p className="font-bold">{team.team_name}</p><p className="mt-1 text-xs text-[var(--ink-muted)]">Captain: {team.captain_name ?? "To be announced"} · {team.member_count} member{team.member_count === 1 ? "" : "s"}</p>{team.continuous_world_country && <p className="mt-2 text-xs font-bold text-[var(--accent)]">Continuous World: {team.continuous_world_country}</p>}</div>)}</div> : <p className="mt-5 rounded-lg bg-[var(--surface-subtle)] p-4 text-sm leading-6 text-[var(--ink-muted)]">No active Team profile is published for this school yet.</p>}<Link href="/league/teams" className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-[var(--accent)]">Open all Teams <ArrowRight size={14} /></Link></Card>
  </main>;
}

function SchoolMark({ school, large = false }: { school: LeagueDirectorySchool; large?: boolean }) {
  const initials = school.school_name.split(/\s+/).map((word) => word[0]).join("").slice(0, 3).toUpperCase();
  return school.logo_url ? <span className={`grid overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface-subtle)] ${large ? "size-20" : "size-11"}`}>
    {/* School Leaders provide remote logo links; rendering them directly avoids an image proxy dependency. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={school.logo_url} alt="" className="size-full object-cover" />
  </span> : <span className={`grid shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] font-bold text-[var(--accent)] ${large ? "size-20 text-xl" : "size-11 text-xs"}`}>{initials}</span>;
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return <Card className="p-5"><p className="text-[10px] font-bold uppercase tracking-[.13em] text-[var(--ink-faint)]">{label}</p><p className="mt-2 text-2xl font-bold tracking-[-.045em]">{value}</p></Card>;
}
