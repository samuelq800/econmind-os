"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Archive,
  ArrowRightLeft,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  KeyRound,
  LoaderCircle,
  LogIn,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Undo2,
  X,
} from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { ApplicationLocationReview } from "@/components/league/application-location-review";
import { SchoolLocationReview, VerifiedSchoolLocationControl } from "@/components/league/school-location-review";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type {
  CrisisRun,
  LeagueApplication,
  LeagueContext,
  LeagueProfile,
  School,
  Team,
  TeamMember,
} from "@/lib/league/types";
import type { CanonicalSchoolLocationInput, SchoolLocationCatalogEntry } from "@/lib/league/geographic-areas";
import type { LeagueChallenge } from "@/lib/league/async-challenge-types";
import {
  createLeagueTeam,
  findSchoolLocationCatalogEntry,
  getLeagueContext,
  joinLeagueTeam,
  listAdminCrisisRuns,
  listAdminLeagueApplications,
  listLeagueProfiles,
  listLeagueSchools,
  listMyCrisisRuns,
  listSchoolCrisisRuns,
  listSchoolTeams,
  matchLeagueApplicationLocation,
  moveLeagueTeamMember,
  renameLeagueTeam,
  reviewLeagueApplication,
  requestLeagueApplicationLocationCorrection,
  requestLeagueSchoolLocationCorrection,
  setAcademicRole,
  setLeaguePlatformRole,
  setLeagueTeamStatus,
  verifyLeagueApplicationLocation,
  verifyLeagueSchoolLocation,
} from "@/lib/supabase/league";
import { listLeagueChallenges, setLeagueChallengeStatus } from "@/lib/supabase/league-challenges";

type TeamWithMembers = Team & { members: TeamMember[] };
const roleLabels = {
  user: "User",
  team_member: "Team member",
  school_leader: "School leader",
  platform_admin: "Platform admin",
} as const;

const academicRoleLabels = {
  student: "Student",
  teacher: "Teacher",
  professor: "Professor",
} as const;

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <Card className="p-4">
      <p className="text-[10px] font-bold uppercase tracking-[.12em] text-[var(--ink-faint)]">
        {label}
      </p>
      <p className="metric-value mt-2 text-2xl font-bold">{value}</p>
    </Card>
  );
}

export function LeagueDashboard({
  paths = {
    quickChallenge: "/league/quick-challenge",
    join: "/league/join",
    arena: "/league/arena",
  },
}: {
  paths?: { quickChallenge: string; join: string; arena: string };
} = {}) {
  const { user, openAuth } = useAuth();
  const userId = user?.id;
  const [context, setContext] = useState<LeagueContext | null>(null);
  const [runs, setRuns] = useState<CrisisRun[]>([]);
  const [schoolRuns, setSchoolRuns] = useState<CrisisRun[]>([]);
  const [teams, setTeams] = useState<TeamWithMembers[]>([]);
  const [applications, setApplications] = useState<LeagueApplication[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [profiles, setProfiles] = useState<LeagueProfile[]>([]);
  const [allRuns, setAllRuns] = useState<
    Array<
      Pick<
        CrisisRun,
        "id" | "user_id" | "team_id" | "total_score" | "completed_at"
      >
    >
  >([]);
  const [challenges, setChallenges] = useState<LeagueChallenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [teamName, setTeamName] = useState("");
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const [renamedTeam, setRenamedTeam] = useState("");
  const [profileSearch, setProfileSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError("");
    try {
      const nextContext = await getLeagueContext(userId);
      setContext(nextContext);
      const ownRuns = await listMyCrisisRuns(userId);
      setRuns(ownRuns);
      if (
        nextContext.profile?.platform_role === "school_leader" &&
        nextContext.school
      ) {
        const [nextTeams, nextSchoolRuns] = await Promise.all([
          listSchoolTeams(nextContext.school.id),
          listSchoolCrisisRuns(nextContext.school.id),
        ]);
        setTeams(nextTeams);
        setSchoolRuns(nextSchoolRuns);
      }
      if (nextContext.profile?.platform_role === "platform_admin") {
        const [nextApplications, nextSchools, nextProfiles, nextRuns, nextChallenges] =
          await Promise.all([
            listAdminLeagueApplications(),
            listLeagueSchools(),
            listLeagueProfiles(),
            listAdminCrisisRuns(),
            listLeagueChallenges(),
          ]);
        setApplications(nextApplications);
        setSchools(nextSchools);
        setProfiles(nextProfiles);
        setAllRuns(nextRuns);
        setChallenges(nextChallenges);
      }
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not load League Dashboard.",
      );
    } finally {
      setLoading(false);
    }
  }, [userId]);
  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, [load]);
  const schoolsById = useMemo(
    () => new Map(schools.map((school) => [school.id, school.name])),
    [schools],
  );
  const schoolsAwaitingLocation = useMemo(
    () => schools.filter((school) => (school.location_status ?? "missing") !== "verified"),
    [schools],
  );
  const schoolsWithVerifiedLocation = useMemo(
    () => schools.filter((school) => school.location_status === "verified"),
    [schools],
  );
  const filteredProfiles = useMemo(() => {
    const query = profileSearch.trim().toLocaleLowerCase();
    if (!query) return profiles;

    return profiles.filter((profile) => {
      const searchableValues = [
        profile.display_name,
        profile.user_id,
        roleLabels[profile.platform_role],
        academicRoleLabels[profile.role ?? "student"],
        profile.school_id ? schoolsById.get(profile.school_id) : "No school",
      ];

      return searchableValues.some((value) =>
        value?.toLocaleLowerCase().includes(query),
      );
    });
  }, [profileSearch, profiles, schoolsById]);
  if (!userId)
    return (
      <main className="mx-auto grid min-h-[65vh] max-w-xl place-items-center px-5 text-center">
        <div>
          <h1 className="text-3xl font-bold">
            Sign in to view your League Dashboard
          </h1>
          <p className="mt-3 text-sm leading-6 text-[var(--ink-muted)]">
            Your team, school and saved Crisis Sprint records stay private to
            your account.
          </p>
          <Button className="mt-6" onClick={() => openAuth("sign-in")}>
            <LogIn size={15} />
            Sign in
          </Button>
        </div>
      </main>
    );
  const role = context?.profile?.platform_role ?? "user";
  async function joinTeam(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const joined = await joinLeagueTeam(inviteCode);
      setMessage(`You joined ${joined.team_name}.`);
      setInviteCode("");
      await load();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not join this team.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function makeTeam(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!context?.school || !userId) return;
    setBusy(true);
    setError("");
    try {
      const team = await createLeagueTeam({
        schoolId: context.school.id,
        name: teamName.trim(),
      });
      setMessage(`${team.name} created. Invite code: ${team.invite_code}`);
      setTeamName("");
      await load();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not create team.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function renameTeam(teamId: string) {
    const nextName = renamedTeam.trim();
    if (!nextName) return;
    setBusy(true);
    setError("");
    try {
      const team = await renameLeagueTeam(teamId, nextName);
      setMessage(`${team.name} renamed.`);
      setEditingTeamId(null);
      setRenamedTeam("");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not rename this team.");
    } finally {
      setBusy(false);
    }
  }
  async function changeTeamStatus(teamId: string, status: Team["status"]) {
    setBusy(true);
    setError("");
    try {
      const team = await setLeagueTeamStatus(teamId, status);
      setMessage(`${team.name} is now ${team.status}.`);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update this team.");
    } finally {
      setBusy(false);
    }
  }
  async function moveMember(userIdToMove: string, fromTeamId: string, toTeamId: string) {
    if (!toTeamId) return;
    setBusy(true);
    setError("");
    try {
      await moveLeagueTeamMember({ userId: userIdToMove, fromTeamId, toTeamId });
      setMessage("Team member moved. Their school association has not changed.");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not move this team member.");
    } finally {
      setBusy(false);
    }
  }
  async function changeChallengeStatus(challengeId: string, status: LeagueChallenge["status"]) {
    setBusy(true);
    setError("");
    try {
      const challenge = await setLeagueChallengeStatus(challengeId, status);
      setMessage(`${challenge.title} is now ${challenge.status}.`);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update Challenge status.");
    } finally {
      setBusy(false);
    }
  }
  async function review(
    id: string,
    status: "approved" | "rejected" | "under_review",
  ) {
    setBusy(true);
    setError("");
    try {
      await reviewLeagueApplication(id, status);
      setMessage(`Application ${status.replace("_", " ")}.`);
      await load();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not review application.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function matchApplicationLocation(applicationId: string, evidenceUrl: string, note: string) {
    setBusy(true);
    setError("");
    try {
      const result = await matchLeagueApplicationLocation(applicationId, evidenceUrl, note);
      setMessage(`${result.city} matched to ${result.location_key}.`);
      await load();
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not match this location.");
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function verifyApplicationLocation(applicationId: string, location: CanonicalSchoolLocationInput) {
    setBusy(true);
    setError("");
    try {
      const result = await verifyLeagueApplicationLocation(applicationId, location);
      setMessage(`Location verified as ${result.location_key}.`);
      await load();
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not verify this location.");
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function requestApplicationLocationCorrection(applicationId: string, note: string) {
    setBusy(true);
    setError("");
    try {
      await requestLeagueApplicationLocationCorrection(applicationId, note);
      setMessage("The location was returned to the applicant for correction.");
      await load();
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not request a location correction.");
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function verifySchoolLocation(schoolId: string, location: CanonicalSchoolLocationInput) {
    setBusy(true);
    setError("");
    try {
      const result = await verifyLeagueSchoolLocation(schoolId, location);
      setMessage(`School location verified as ${result.location_key}.`);
      await load();
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not verify this school location.");
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function requestSchoolLocationCorrection(schoolId: string, note: string) {
    setBusy(true);
    setError("");
    try {
      await requestLeagueSchoolLocationCorrection(schoolId, note);
      setMessage("The school location was removed from the public map and returned to the review queue.");
      await load();
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not withdraw this school location.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function findCatalogLocation(geonameId: number): Promise<SchoolLocationCatalogEntry | null> {
    setError("");
    try {
      return await findSchoolLocationCatalogEntry(geonameId);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not check the verified location catalog.");
      throw caught;
    }
  }
  async function changeRole(
    userId: string,
    platformRole: LeagueProfile["platform_role"],
  ) {
    setBusy(true);
    setError("");
    try {
      await setLeaguePlatformRole(userId, platformRole);
      setMessage("Platform role updated.");
      await load();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not update platform role.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function changeAcademicRole(
    userId: string,
    academicRole: "student" | "teacher" | "professor",
  ) {
    setBusy(true);
    setError("");
    try {
      await setAcademicRole(userId, academicRole);
      setMessage("Academic role updated. Professor remains independent of school and World Simulation authority.");
      await load();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not update academic role.",
      );
    } finally {
      setBusy(false);
    }
  }
  const bestScore = runs.length
    ? Math.max(...runs.map((run) => run.total_score)).toFixed(1)
    : "—";
  return (
    <main className="mx-auto min-h-screen max-w-7xl px-5 py-12 sm:px-8">
      <header className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[.18em] text-[var(--accent)]">
            League Dashboard
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-[-.05em]">
            {context?.profile?.display_name || "Your economic league"}
          </h1>
          <p className="mt-3 text-sm leading-6 text-[var(--ink-muted)]">
            Role: <b className="text-[var(--ink)]">{roleLabels[role]}</b>
            {context?.school
              ? ` · ${context.school.name}`
              : " · No school joined yet"}
          </p>
        </div>
        <Link
          href="/profile"
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-4 text-sm font-bold"
        >
          <ClipboardCheck size={15} />
          Edit profile
        </Link>
      </header>
      {error && (
        <p
          role="alert"
          className="mt-5 rounded-lg bg-[var(--red-soft)] p-4 text-sm text-[var(--red)]"
        >
          {error}
        </p>
      )}
      {message && (
        <p className="mt-5 flex items-center gap-2 rounded-lg bg-[var(--accent-soft)] p-4 text-sm font-semibold text-[var(--accent)]">
          <CheckCircle2 size={15} />
          {message}
        </p>
      )}
      {loading ? (
        <div className="grid min-h-64 place-items-center">
          <LoaderCircle className="animate-spin text-[var(--accent)]" />
        </div>
      ) : (
        <>
          <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Metric label="Quick Challenge best" value={bestScore} />
            <Metric label="Saved runs" value={runs.length} />
            <Metric
              label="School"
              value={context?.school?.name ?? "Not joined"}
            />
            <Metric
              label="Team"
              value={context?.membership?.team?.name ?? "Personal record"}
            />
          </section>
          <section className="mt-8 grid gap-5 lg:grid-cols-[1.05fr_.95fr]">
            <Card className="p-6">
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-lg font-bold">
                  Recent Quick Challenge records
                </h2>
                <Link
                  href={paths.quickChallenge}
                  className="text-xs font-bold text-[var(--accent)]"
                >
                  Run sprint <ArrowRight className="inline" size={13} />
                </Link>
              </div>
              <div className="mt-5 space-y-3">
                {runs.map((run) => (
                  <div
                    key={run.id}
                    className="flex items-center justify-between gap-4 border-b border-[var(--line)] pb-3 last:border-0"
                  >
                    <div>
                      <p className="text-sm font-bold">{run.result_type}</p>
                      <p className="mt-1 text-[10px] text-[var(--ink-faint)]">
                        {new Date(run.completed_at).toLocaleString()} ·{" "}
                        {run.team?.name ?? "Personal"}
                      </p>
                    </div>
                    <b className="text-[var(--accent)]">
                      {run.total_score.toFixed(1)}
                    </b>
                  </div>
                ))}
                {runs.length === 0 && (
                  <p className="text-sm leading-6 text-[var(--ink-muted)]">
                    No saved run yet. Complete a Quick Challenge to build this
                    private record.
                  </p>
                )}
              </div>
            </Card>
            <Card className="p-6">
              <h2 className="text-lg font-bold">Join a team</h2>
              <p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">
                Use the eight-character invite code from a school leader. You
                may join more than one team within your own school.
              </p>
              <form
                className="mt-5 flex gap-2"
                onSubmit={(event) => void joinTeam(event)}
              >
                <input
                  required
                  maxLength={8}
                  value={inviteCode}
                  onChange={(event) =>
                    setInviteCode(event.target.value.toUpperCase())
                  }
                  placeholder="e.g. A1B2C3D4"
                  className="h-10 min-w-0 flex-1 rounded-lg border border-[var(--line)] bg-[var(--canvas)] px-3 font-mono text-sm uppercase"
                />
                <Button disabled={busy} type="submit">
                  <KeyRound size={14} />
                  Join
                </Button>
              </form>
              <Link
                href={paths.join}
                className="mt-5 inline-flex text-xs font-bold text-[var(--accent)]"
              >
                Or submit a school application{" "}
                <ArrowRight className="ml-1" size={13} />
              </Link>
            </Card>
          </section>
          <section className="mt-8">
            <h2 className="text-xl font-bold">Planned League modules</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {[
                ["Model Battle", "Pilot Ready"],
                ["Market Strategy League", "Planned"],
                ["Behavioural Economics Lab", "Preview"],
              ].map(([title, status]) => (
                <Card key={title} className="p-5">
                  <Badge>{status}</Badge>
                  <p className="mt-4 text-sm font-bold">{title}</p>
                </Card>
              ))}
            </div>
          </section>
          {role === "school_leader" && context?.school && (
            <section className="mt-10 border-t border-[var(--line)] pt-10">
              <div className="flex items-center gap-3">
                <Building2 className="text-[var(--accent)]" size={20} />
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[.16em] text-[var(--accent)]">
                    School leader tools
                  </p>
                  <h2 className="mt-1 text-2xl font-bold">
                    {context.school.name}
                  </h2>
                </div>
              </div>
              <div className="mt-6 grid gap-5 lg:grid-cols-[.8fr_1.2fr]">
                <Card className="p-6">
                  <h3 className="font-bold">Create a school team</h3>
                  <form
                    className="mt-4 flex gap-2"
                    onSubmit={(event) => void makeTeam(event)}
                  >
                    <input
                      required
                      minLength={2}
                      maxLength={100}
                      value={teamName}
                      onChange={(event) => setTeamName(event.target.value)}
                      placeholder="Team name"
                      className="h-10 min-w-0 flex-1 rounded-lg border border-[var(--line)] bg-[var(--canvas)] px-3 text-sm"
                    />
                    <Button type="submit" disabled={busy}>
                      <Plus size={14} />
                      Create
                    </Button>
                  </form>
                  <p className="mt-3 text-xs leading-5 text-[var(--ink-muted)]">
                    The new team gets a unique eight-character invite code.
                    You become captain, and can later manage independent
                    Challenge roles for each team.
                  </p>
                </Card>
                <Card className="p-6">
                  <h3 className="font-bold">Your teams</h3>
                  <div className="mt-4 space-y-3">
                    {teams.map((team) => (
                      <div
                        key={team.id}
                        className="rounded-lg bg-[var(--surface-subtle)] p-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          {editingTeamId === team.id ? <form className="flex min-w-0 flex-1 gap-2" onSubmit={(event) => { event.preventDefault(); void renameTeam(team.id); }}><input autoFocus required minLength={2} maxLength={100} value={renamedTeam} onChange={(event) => setRenamedTeam(event.target.value)} className="h-9 min-w-0 flex-1 rounded-lg border border-[var(--line)] bg-[var(--canvas)] px-2 text-sm" /><Button size="sm" disabled={busy} type="submit">Save</Button><Button size="sm" variant="ghost" type="button" onClick={() => { setEditingTeamId(null); setRenamedTeam(""); }}>Cancel</Button></form> : <><div className="flex items-center gap-2"><p className="font-bold">{team.name}</p><Badge>{team.status}</Badge></div><code className="rounded bg-[var(--surface)] px-2 py-1 text-xs font-bold text-[var(--accent)]">{team.invite_code}</code></>}
                        </div>
                        <p className="mt-2 text-xs text-[var(--ink-muted)]">
                          {team.members.length} member
                          {team.members.length === 1 ? "" : "s"} · share this
                          code to join
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2"><Button size="sm" variant="ghost" disabled={busy || editingTeamId === team.id} onClick={() => { setEditingTeamId(team.id); setRenamedTeam(team.name); }}><Pencil size={13} /> Rename</Button>{team.status === "archived" ? <Button size="sm" variant="ghost" disabled={busy} onClick={() => void changeTeamStatus(team.id, "active")}><Undo2 size={13} /> Restore</Button> : <Button size="sm" variant="ghost" disabled={busy} onClick={() => void changeTeamStatus(team.id, "archived")}><Archive size={13} /> Archive</Button>}<Link href={paths.arena} className="inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold text-[var(--accent)] hover:bg-[var(--surface)]">Challenges <ArrowRight size={13} /></Link></div>
                        {teams.length > 1 && team.members.length > 0 && <div className="mt-4 border-t border-[var(--line)] pt-3"><p className="text-[10px] font-bold uppercase tracking-[.12em] text-[var(--ink-faint)]">Move member</p><div className="mt-2 space-y-2">{team.members.filter((member) => member.team_role !== "captain").map((member) => <label key={member.id} className="flex items-center justify-between gap-2 text-xs"><span className="min-w-0 truncate">{member.profile?.display_name ?? member.user_id.slice(0, 8)}</span><span className="flex shrink-0 items-center gap-1"><ArrowRightLeft size={12} /><select aria-label={`Move ${member.profile?.display_name ?? "member"}`} defaultValue="" disabled={busy} onChange={(event) => void moveMember(member.user_id, team.id, event.target.value)} className="h-7 max-w-32 rounded border border-[var(--line)] bg-[var(--canvas)] px-1 text-[10px]"><option value="">Move to…</option>{teams.filter((target) => target.id !== team.id && target.status === "active").map((target) => <option key={target.id} value={target.id}>{target.name}</option>)}</select></span></label>)}</div></div>}
                      </div>
                    ))}
                    {teams.length === 0 && (
                      <p className="text-sm text-[var(--ink-muted)]">
                        No teams created yet.
                      </p>
                    )}
                  </div>
                </Card>
              </div>
              <Card className="mt-5 p-6">
                <h3 className="font-bold">School Crisis Sprint records</h3>
                <div className="mt-4 space-y-2">
                  {schoolRuns.map((run) => (
                    <div
                      key={run.id}
                      className="flex justify-between gap-4 border-b border-[var(--line)] pb-2 text-sm"
                    >
                      <span>
                        {run.team?.name ?? "Personal"} · {run.result_type}
                      </span>
                      <b>{run.total_score.toFixed(1)}</b>
                    </div>
                  ))}
                  {schoolRuns.length === 0 && (
                    <p className="text-sm text-[var(--ink-muted)]">
                      No school team record has been saved yet.
                    </p>
                  )}
                </div>
              </Card>
            </section>
          )}
          {role === "platform_admin" && (
            <section className="mt-10 border-t border-[var(--line)] pt-10">
              <div className="flex items-center gap-3">
                <ShieldCheck className="text-[var(--accent)]" size={20} />
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[.16em] text-[var(--accent)]">
                    Platform administration
                  </p>
                  <h2 className="mt-1 text-2xl font-bold">League oversight</h2>
                </div>
              </div>
              <section className="mt-6 grid gap-4 sm:grid-cols-3">
                <Metric label="Schools" value={schools.length} />
                <Metric label="Crisis runs" value={allRuns.length} />
                <Metric
                  label="Completion rate"
                  value={allRuns.length ? "100%" : "—"}
                />
              </section>
              <Card className="mt-5 p-6">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <h3 className="font-bold">Pending school locations</h3>
                    <p className="mt-2 max-w-2xl text-xs leading-5 text-[var(--ink-muted)]">
                      Historic schools without a verified city stay off the map. Confirm GeoNames and independent evidence here; never use a campus address.
                    </p>
                  </div>
                  <span className="text-xs font-bold text-[var(--ink-faint)]">{schoolsAwaitingLocation.length} pending</span>
                </div>
                <div className="mt-4">
                  {schoolsAwaitingLocation.map((school) => (
                    <SchoolLocationReview
                      key={school.id}
                      school={school}
                      busy={busy}
                      onFindCatalogLocation={findCatalogLocation}
                      onVerify={(location) => verifySchoolLocation(school.id, location)}
                    />
                  ))}
                  {schoolsAwaitingLocation.length === 0 && <p className="text-sm text-[var(--ink-muted)]">Every persisted school has a verified city-level location.</p>}
                </div>
                {schoolsWithVerifiedLocation.length > 0 && (
                  <details className="mt-5 border-t border-[var(--line)] pt-4">
                    <summary className="cursor-pointer text-xs font-bold text-[var(--ink-muted)]">
                      Review {schoolsWithVerifiedLocation.length} verified map point{schoolsWithVerifiedLocation.length === 1 ? "" : "s"}
                    </summary>
                    <p className="mt-3 text-xs leading-5 text-[var(--ink-muted)]">
                      If later evidence shows a city is wrong, withdraw it immediately. The school stays in the directory but remains off-map until re-verified.
                    </p>
                    <div className="mt-2">
                      {schoolsWithVerifiedLocation.map((school) => (
                        <VerifiedSchoolLocationControl
                          key={school.id}
                          school={school}
                          busy={busy}
                          onRequestCorrection={(note) => requestSchoolLocationCorrection(school.id, note)}
                        />
                      ))}
                    </div>
                  </details>
                )}
              </Card>
              <div className="mt-6 grid gap-5 xl:grid-cols-2">
                <Card className="p-6">
                  <h3 className="font-bold">School applications</h3>
                  <div className="mt-4 space-y-4">
                    {applications.map((application) => (
                      <div
                        key={application.id}
                        className="border-b border-[var(--line)] pb-4 last:border-0"
                      >
                        <p className="text-sm font-bold">
                          {application.school_name}
                        </p>
                        <p className="mt-1 text-xs text-[var(--ink-muted)]">
                          {application.contact_person} ·{" "}
                          {application.expected_teams} team(s) ·{" "}
                          {application.status}
                        </p>
                        <ApplicationLocationReview
                          application={application}
                          busy={busy}
                          onFindCatalogLocation={findCatalogLocation}
                          onMatch={(evidenceUrl, note) => matchApplicationLocation(application.id, evidenceUrl, note)}
                          onVerify={(location) => verifyApplicationLocation(application.id, location)}
                          onRequestCorrection={(note) => requestApplicationLocationCorrection(application.id, note)}
                        />
                        {["submitted", "under_review"].includes(
                          application.status,
                        ) && (
                          <div className="mt-3">
                            {application.location_status !== "verified" && (
                              <p className="mb-2 text-xs leading-5 text-[var(--ink-muted)]">
                                City review is optional for approval. Until it is confirmed, this school remains off the public map.
                              </p>
                            )}
                            <div className="flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              disabled={busy}
                              onClick={() =>
                                void review(application.id, "approved")
                              }
                            >
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              disabled={busy}
                              onClick={() =>
                                void review(application.id, "under_review")
                              }
                            >
                              Review
                            </Button>
                            <Button
                              size="sm"
                              variant="danger"
                              disabled={busy}
                              onClick={() =>
                                void review(application.id, "rejected")
                              }
                            >
                              Reject
                            </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                    {applications.length === 0 && (
                      <p className="text-sm text-[var(--ink-muted)]">
                        No League applications yet.
                      </p>
                    )}
                  </div>
                </Card>
                <Card className="p-6">
                  <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                      <h3 className="font-bold">Users and League roles</h3>
                      <p className="mt-1 text-[10px] text-[var(--ink-faint)]">
                        {profileSearch.trim()
                          ? `${filteredProfiles.length} of ${profiles.length} users`
                          : `${profiles.length} users`}
                      </p>
                    </div>
                    <label className="relative min-w-0 flex-1 sm:max-w-72">
                      <span className="sr-only">Search users</span>
                      <Search
                        aria-hidden="true"
                        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-faint)]"
                        size={15}
                      />
                      <input
                        type="search"
                        value={profileSearch}
                        onChange={(event) =>
                          setProfileSearch(event.target.value)
                        }
                        placeholder="Search name, ID, school or role"
                        className="h-10 w-full appearance-none rounded-lg border border-[var(--line)] bg-[var(--canvas)] pl-9 pr-9 text-xs outline-none transition [&::-webkit-search-cancel-button]:hidden focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)]"
                      />
                      {profileSearch && (
                        <button
                          type="button"
                          aria-label="Clear user search"
                          onClick={() => setProfileSearch("")}
                          className="absolute right-1.5 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-md text-[var(--ink-faint)] transition hover:bg-[var(--surface-subtle)] hover:text-[var(--ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </label>
                  </div>
                  <div className="mt-4 space-y-3">
                    {filteredProfiles.map((profile) => (
                      <div
                        key={profile.user_id}
                        className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] pb-3 last:border-0"
                      >
                        <div>
                          <p className="text-sm font-bold">
                            {profile.display_name ||
                              profile.user_id.slice(0, 8)}
                          </p>
                          <p className="text-[10px] text-[var(--ink-faint)]">
                            {profile.school_id
                              ? schoolsById.get(profile.school_id) ??
                                "School associated"
                              : "No school"}
                            {" · "}{academicRoleLabels[profile.role ?? "student"]}
                          </p>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2">
                          <label className="text-[9px] font-bold uppercase tracking-wide text-[var(--ink-faint)]">League role
                            <select
                              value={profile.platform_role}
                              disabled={busy}
                              onChange={(event) =>
                                void changeRole(
                                  profile.user_id,
                                  event.target
                                    .value as LeagueProfile["platform_role"],
                                )
                              }
                              className="mt-1 h-9 rounded-lg border border-[var(--line)] bg-[var(--canvas)] px-2 text-xs normal-case tracking-normal text-[var(--ink)]"
                            >
                              <option value="user">User</option>
                              <option value="team_member">Team member</option>
                              <option value="school_leader">School leader</option>
                              <option value="platform_admin">Platform admin</option>
                            </select>
                          </label>
                          <label className="text-[9px] font-bold uppercase tracking-wide text-[var(--ink-faint)]">Academic role
                            <select
                              value={profile.role ?? "student"}
                              disabled={busy}
                              onChange={(event) =>
                                void changeAcademicRole(
                                  profile.user_id,
                                  event.target.value as "student" | "teacher" | "professor",
                                )
                              }
                              className="mt-1 h-9 rounded-lg border border-[var(--line)] bg-[var(--canvas)] px-2 text-xs normal-case tracking-normal text-[var(--ink)]"
                            >
                              <option value="student">Student</option>
                              <option value="teacher">Teacher</option>
                              <option value="professor">Professor</option>
                            </select>
                          </label>
                        </div>
                      </div>
                    ))}
                    {filteredProfiles.length === 0 && (
                      <div className="rounded-lg border border-dashed border-[var(--line)] px-4 py-8 text-center">
                        <Search
                          aria-hidden="true"
                          className="mx-auto text-[var(--ink-faint)]"
                          size={20}
                        />
                        <p className="mt-3 text-sm font-bold">No users found</p>
                        <p className="mt-1 text-xs text-[var(--ink-muted)]">
                          Try a name, user ID, school or role.
                        </p>
                      </div>
                    )}
                  </div>
                </Card>
              </div>
              <Card className="mt-5 p-6">
                <h3 className="font-bold">Demo leaderboard</h3>
                <p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">
                  No demo teams or results have been seeded. This is
                  intentional: the meeting build does not present fictional
                  school results as real competition data.
                </p>
              </Card>
              <Card className="mt-5 p-6">
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <h3 className="font-bold">Asynchronous Challenge status</h3>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--ink-muted)]">
                      Challenge definitions, fixed starting conditions and scoring
                      live in the reviewed code and database seed. This panel
                      only controls public availability; official attempts stay
                      saved, locked and auditable.
                    </p>
                  </div>
                  <Link href={paths.arena} className="text-xs font-bold text-[var(--accent)]">
                    Open Simulation Arena <ArrowRight className="inline" size={13} />
                  </Link>
                </div>
                <div className="mt-5 grid gap-3 lg:grid-cols-3">
                  {challenges.map((challenge) => (
                    <div key={challenge.id} className="rounded-lg bg-[var(--surface-subtle)] p-4">
                      <p className="text-sm font-bold">{challenge.title}</p>
                      <p className="mt-1 text-xs text-[var(--ink-muted)]">
                        {challenge.official_attempt_limit} official attempts · {challenge.stage_count} stages
                      </p>
                      <select
                        className="mt-3 h-9 w-full rounded-lg border border-[var(--line)] bg-[var(--canvas)] px-2 text-xs"
                        value={challenge.status}
                        disabled={busy}
                        onChange={(event) => void changeChallengeStatus(challenge.id, event.target.value as LeagueChallenge["status"])}
                      >
                        <option value="draft">Draft</option>
                        <option value="open">Open</option>
                        <option value="closed">Closed</option>
                        <option value="archived">Archived</option>
                      </select>
                    </div>
                  ))}
                  {challenges.length === 0 && <p className="text-sm text-[var(--ink-muted)]">No seeded asynchronous Challenge is available yet.</p>}
                </div>
              </Card>
            </section>
          )}
        </>
      )}
    </main>
  );
}
