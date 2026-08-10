"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, BadgeCheck, ImagePlus, LoaderCircle, Pencil, UsersRound } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LEAGUE_ACHIEVEMENTS } from "@/lib/league/league-season";
import { PARTICIPATING_SCHOOLS } from "@/lib/league/participating-schools";
import { getLeagueContext } from "@/lib/supabase/league";
import type { PublicLeagueSchool, PublicLeagueTeam } from "@/lib/supabase/league-directory";
import { listPublicLeagueSchools, listPublicLeagueTeams, updateLeagueSchoolProfile } from "@/lib/supabase/league-directory";

type DirectorySchool = PublicLeagueSchool & { region: string; isEditorialRoster: boolean };

function normaliseName(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function editorialSchool(name: string, city: string, region: string): DirectorySchool {
  return {
    school_id: `editorial-${normaliseName(name)}`,
    school_name: name,
    club_name: null,
    city,
    description: null,
    logo_url: null,
    member_count: 0,
    team_count: 0,
    current_season_points: 0,
    official_challenge_count: 0,
    official_wins: 0,
    achievements: [],
    region,
    isEditorialRoster: true,
  };
}

function mergeDirectory(rows: PublicLeagueSchool[]) {
  const registered = new Map(rows.map((row) => [normaliseName(row.school_name), row]));
  const roster = PARTICIPATING_SCHOOLS.map((school) => {
    const row = registered.get(normaliseName(school.name));
    return row
      ? { ...row, school_name: school.name, city: row.city ?? school.city, region: school.region, isEditorialRoster: true }
      : editorialSchool(school.name, school.city, school.region);
  });
  const rosterKeys = new Set(PARTICIPATING_SCHOOLS.map((school) => normaliseName(school.name)));
  const additional = rows
    .filter((row) => !rosterKeys.has(normaliseName(row.school_name)))
    .map((row) => ({ ...row, region: "League partner", isEditorialRoster: false }));
  return [...roster, ...additional];
}

export function LeagueSchools({ profileName }: { profileName?: string | null }) {
  const { user } = useAuth();
  const [rows, setRows] = useState<PublicLeagueSchool[]>([]);
  const [publicTeams, setPublicTeams] = useState<PublicLeagueTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [leaderSchoolId, setLeaderSchoolId] = useState<string | null>(null);
  const [canManage, setCanManage] = useState(false);

  const load = useCallback(async () => {
    try {
      setRows(await listPublicLeagueSchools());
    } catch {
      // The static partner roster keeps the public League useful before the
      // optional directory migration has been applied.
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { queueMicrotask(() => { void load(); }); }, [load]);
  useEffect(() => {
    if (!profileName) return;
    queueMicrotask(() => { void listPublicLeagueTeams().then(setPublicTeams).catch(() => setPublicTeams([])); });
  }, [profileName]);
  useEffect(() => {
    if (!user) return;
    void getLeagueContext(user.id).then((context) => {
      setLeaderSchoolId(context.school?.id ?? null);
      setCanManage(context.profile?.platform_role === "school_leader" || context.profile?.platform_role === "platform_admin");
    }).catch(() => undefined);
  }, [user]);

  const schools = useMemo(() => mergeDirectory(rows), [rows]);
  const requested = profileName ? decodeURIComponent(profileName) : null;
  const selected = requested ? schools.find((school) => normaliseName(school.school_name) === normaliseName(requested)) ?? null : null;
  const selectedTeams = selected ? publicTeams.filter((team) => team.school_id === selected.school_id || normaliseName(team.school_name) === normaliseName(selected.school_name)) : [];

  if (profileName) {
    return <SchoolProfile school={selected} teams={selectedTeams} canManage={Boolean(selected && canManage && selected.school_id === leaderSchoolId)} refresh={load} loading={loading} />;
  }

  return <main className="mx-auto min-h-screen max-w-[1440px] px-5 py-10 sm:px-8 lg:px-12"><header className="grid gap-7 border-b border-[var(--line)] pb-9 lg:grid-cols-[1.1fr_.9fr] lg:items-end"><div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-[var(--accent)]">EconMind League · partner network</p><h1 className="mt-2 text-5xl font-bold tracking-[-.07em] sm:text-6xl">Schools</h1><p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--ink-muted)]">Each school is a public League identity. Teams compete independently, while School Leaders manage their own school profile and team structure.</p></div><Card className="p-5"><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[var(--accent)]">Directory access</p><p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">School names, public Team counts and official aggregate results are visible here. Membership, invite codes and strategy data remain private.</p></Card></header><section className="mt-10"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-[var(--accent)]">Participating schools</p><h2 className="mt-2 text-2xl font-bold">{schools.length} schools in the public network</h2></div><Link href="/league/join" className="inline-flex items-center gap-2 text-sm font-bold text-[var(--accent)]">Join your school <ArrowRight size={14} /></Link></div>{loading ? <div className="grid min-h-48 place-items-center"><LoaderCircle className="animate-spin text-[var(--accent)]" /></div> : <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{schools.map((school, index) => <SchoolCard key={school.school_id} school={school} index={index} />)}</div>}</section></main>;
}

export function LeagueSchoolProfile() {
  const searchParams = useSearchParams();
  return <LeagueSchools profileName={searchParams.get("school")} />;
}

function SchoolCard({ school, index }: { school: DirectorySchool; index: number }) {
  return <Card className="flex min-h-64 flex-col p-6"><div className="flex items-start justify-between gap-4"><SchoolMark school={school} /><span className="text-[10px] font-bold tracking-[.13em] text-[var(--ink-faint)]">{String(index + 1).padStart(2, "0")}</span></div><p className="mt-5 text-[10px] font-bold uppercase tracking-[.13em] text-[var(--accent)]">{school.city ?? "League partner"} · {school.region}</p><h2 className="mt-2 text-xl font-bold tracking-[-.035em]">{school.school_name}</h2><p className="mt-3 line-clamp-3 text-sm leading-6 text-[var(--ink-muted)]">{school.description ?? school.club_name ?? "Partner school in the EconMind inter-school economics network."}</p><div className="mt-auto flex items-center justify-between gap-3 border-t border-[var(--line)] pt-5"><span className="text-xs text-[var(--ink-muted)]">{school.team_count ? `${school.team_count} active team${school.team_count === 1 ? "" : "s"}` : "Team profile pending"}</span><Link href={`/league/schools/profile/?school=${encodeURIComponent(school.school_name)}`} className="inline-flex items-center gap-1 text-sm font-bold text-[var(--accent)]">Profile <ArrowRight size={14} /></Link></div></Card>;
}

function SchoolProfile({ school, teams, canManage, refresh, loading }: { school: DirectorySchool | null; teams: PublicLeagueTeam[]; canManage: boolean; refresh: () => Promise<void>; loading: boolean }) {
  const [editing, setEditing] = useState(false);
  const [description, setDescription] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function save() {
    if (!school || school.isEditorialRoster) return;
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

  if (loading) return <main className="grid min-h-[60vh] place-items-center"><LoaderCircle className="animate-spin text-[var(--accent)]" /></main>;
  if (!school) return <main className="mx-auto min-h-[60vh] max-w-4xl px-5 py-16"><Link href="/league/schools" className="inline-flex items-center gap-2 text-sm font-bold text-[var(--accent)]"><ArrowLeft size={14} /> All schools</Link><h1 className="mt-8 text-4xl font-bold">School not found</h1><p className="mt-4 text-[var(--ink-muted)]">This public profile is not in the League directory.</p></main>;

  const noPublishedData = school.team_count === 0 && school.member_count === 0 && school.official_challenge_count === 0;
  return <main className="mx-auto min-h-screen max-w-[1240px] px-5 py-10 sm:px-8 lg:px-12"><Link href="/league/schools" className="inline-flex items-center gap-2 text-sm font-bold text-[var(--accent)]"><ArrowLeft size={14} /> Schools</Link><header className="mt-8 grid gap-7 border-b border-[var(--line)] pb-9 md:grid-cols-[auto_1fr_auto] md:items-start"><SchoolMark school={school} large /><div><p className="text-[10px] font-bold uppercase tracking-[.17em] text-[var(--accent)]">{school.city ?? "League partner"} · {school.region}</p><h1 className="mt-2 text-4xl font-bold tracking-[-.06em] sm:text-5xl">{school.school_name}</h1><p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--ink-muted)]">{school.description ?? school.club_name ?? "This partner school is part of the EconMind League public network."}</p></div>{canManage && <Button variant="secondary" onClick={toggleEditing}><Pencil size={15} /> {editing ? "Cancel editing" : "Edit school profile"}</Button>}</header>{message && <p className="mt-5 rounded-lg bg-[var(--accent-soft)] p-4 text-sm text-[var(--accent)]">{message}</p>}{error && <p role="alert" className="mt-5 rounded-lg bg-[var(--red-soft)] p-4 text-sm text-[var(--red)]">{error}</p>}{editing && <Card className="mt-7 p-6"><div className="flex items-start gap-3"><ImagePlus className="mt-0.5 text-[var(--accent)]" size={18} /><div><h2 className="font-bold">School profile</h2><p className="mt-1 text-sm text-[var(--ink-muted)]">This public description and logo link are only editable by your School Leader.</p></div></div><label className="mt-5 block text-sm font-bold">Description<textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={1200} className="mt-2 min-h-28 w-full rounded-lg border border-[var(--line)] bg-[var(--surface-subtle)] p-3 font-normal outline-none focus:border-[var(--accent)]" /></label><label className="mt-4 block text-sm font-bold">Logo URL <span className="font-normal text-[var(--ink-muted)]">(optional, https://)</span><input value={logoUrl} onChange={(event) => setLogoUrl(event.target.value)} className="mt-2 h-10 w-full rounded-lg border border-[var(--line)] bg-[var(--surface-subtle)] px-3 font-normal outline-none focus:border-[var(--accent)]" placeholder="https://…" /></label><Button className="mt-5" onClick={() => void save()} disabled={saving}>{saving ? "Saving…" : "Save school profile"}</Button></Card>}
    <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><Stat label="Members" value={school.member_count || "—"} /><Stat label="Active teams" value={school.team_count || "—"} /><Stat label="Season points" value={school.current_season_points ? school.current_season_points.toFixed(1) : "—"} /><Stat label="Official challenges" value={school.official_challenge_count || "—"} /></section>
    <section className="mt-8 grid gap-5 lg:grid-cols-2"><Card className="p-6"><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[var(--accent)]">Achievements</p><h2 className="mt-2 text-xl font-bold">Official milestones</h2><div className="mt-5 flex flex-wrap gap-2">{school.achievements.length ? school.achievements.map((achievement) => <Badge key={achievement} className="border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"><BadgeCheck size={13} /> {achievement}</Badge>) : LEAGUE_ACHIEVEMENTS.map((achievement) => <span key={achievement} className="rounded-full border border-[var(--line)] px-3 py-1.5 text-xs text-[var(--ink-muted)]">{achievement} · pending</span>)}</div><p className="mt-5 text-sm leading-6 text-[var(--ink-muted)]">Badges are awarded automatically from published official results. No manual school-score adjustment is available.</p></Card><Card className="p-6"><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[var(--accent)]">Official history</p><h2 className="mt-2 text-xl font-bold">Season record</h2><p className="mt-5 text-sm leading-6 text-[var(--ink-muted)]">{noPublishedData ? "No official season result has been published for this school. Season 1 is currently preparing." : `${school.official_challenge_count} official challenge result${school.official_challenge_count === 1 ? "" : "s"} contribute to this public school summary.`}</p><Link href="/league/standings" className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-[var(--accent)]">View standings <ArrowRight size={14} /></Link></Card></section>
    <Card className="mt-5 p-6"><div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[var(--accent)]">Current active teams</p><h2 className="mt-2 text-xl font-bold">Team directory</h2><p className="mt-3 text-sm leading-6 text-[var(--ink-muted)]">Public active Teams show their captain and aggregate League record. Private membership details and invite codes remain visible only to authorised school users.</p></div><UsersRound className="text-[var(--accent)]" size={22} /></div>{teams.length ? <div className="mt-5 grid gap-3 sm:grid-cols-2">{teams.map((team) => <div key={team.team_id} className="rounded-lg bg-[var(--surface-subtle)] p-4"><p className="font-bold">{team.team_name}</p><p className="mt-1 text-xs text-[var(--ink-muted)]">Captain: {team.captain_name ?? "To be announced"} · {team.member_count} member{team.member_count === 1 ? "" : "s"}</p>{team.continuous_world_country && <p className="mt-2 text-xs font-bold text-[var(--accent)]">Continuous World: {team.continuous_world_country}</p>}</div>)}</div> : <p className="mt-5 rounded-lg bg-[var(--surface-subtle)] p-4 text-sm leading-6 text-[var(--ink-muted)]">No active Team profile is published for this school yet.</p>}<Link href="/league/teams" className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-[var(--accent)]">Open all Teams <ArrowRight size={14} /></Link></Card>
  </main>;
}

function SchoolMark({ school, large = false }: { school: DirectorySchool; large?: boolean }) {
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
