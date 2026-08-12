"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Building2, Globe2, LoaderCircle, Trophy, UsersRound } from "lucide-react";
import { Card } from "@/components/ui/card";
import { LEAGUE_RANKING_CATEGORIES, LEAGUE_SEASON, type LeagueRankingCategory } from "@/lib/league/league-season";
import type { PublicLeagueSchool, PublicLeagueTeam } from "@/lib/supabase/league-directory";
import { listPublicLeagueSchools, listPublicLeagueTeams } from "@/lib/supabase/league-directory";

type StandingTab = "schools" | "teams" | "individuals" | "world";
const tabs: Array<{ id: StandingTab; label: string; icon: typeof Building2 }> = [
  { id: "schools", label: "Schools", icon: Building2 },
  { id: "teams", label: "Teams", icon: UsersRound },
  { id: "individuals", label: "Individuals", icon: UsersRound },
  { id: "world", label: "Continuous World", icon: Globe2 },
];

export function LeagueStandings({ worldLeaderboardPath = "/league/world/leaderboard" }: { worldLeaderboardPath?: string } = {}) {
  const [tab, setTab] = useState<StandingTab>("schools");
  const [category, setCategory] = useState<LeagueRankingCategory>("Overall");
  const [schools, setSchools] = useState<PublicLeagueSchool[]>([]);
  const [teams, setTeams] = useState<PublicLeagueTeam[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void Promise.all([listPublicLeagueSchools(), listPublicLeagueTeams()])
      .then(([schoolRows, teamRows]) => { setSchools(schoolRows); setTeams(teamRows); })
      .catch(() => { setSchools([]); setTeams([]); })
      .finally(() => setLoading(false));
  }, []);

  const sortedSchools = useMemo(() => sortSchools(schools, category), [schools, category]);
  const sortedTeams = useMemo(() => sortTeams(teams, category), [teams, category]);

  return <main className="mx-auto min-h-screen max-w-[1240px] px-5 py-10 sm:px-8 lg:px-12"><header className="border-b border-[var(--line)] pb-9"><p className="text-[10px] font-bold uppercase tracking-[.18em] text-[var(--accent)]">Published League results</p><h1 className="mt-2 text-5xl font-bold tracking-[-.07em]">Standings</h1><p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--ink-muted)]">League standings distinguish school identity, Team competition and the independently running Continuous World Economy. They only use released official results; active decisions are never visible here.</p></header><div className="mt-8 flex flex-wrap gap-2" role="tablist" aria-label="League standings views">{tabs.map(({ id, label, icon: Icon }) => <button type="button" role="tab" aria-selected={tab === id} key={id} onClick={() => setTab(id)} className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold ${tab === id ? "bg-[var(--accent)] text-white" : "border border-[var(--line)] text-[var(--ink-muted)] hover:bg-[var(--surface-subtle)]"}`}><Icon size={15} /> {label}{id === "individuals" && <span className="text-[10px] font-bold opacity-70">Disabled</span>}</button>)}</div>{tab === "individuals" ? <IndividualsDisabled /> : tab === "world" ? <ContinuousWorldStanding worldLeaderboardPath={worldLeaderboardPath} /> : <><section className="mt-8 flex flex-wrap items-end justify-between gap-5"><div><p className="text-[10px] font-bold uppercase tracking-[.15em] text-[var(--accent)]">{LEAGUE_SEASON.title} · Coming soon</p><h2 className="mt-2 text-2xl font-bold">{tab === "schools" ? "School standings" : "Team standings"}</h2></div><div className="flex flex-wrap gap-2" aria-label="Ranking category">{LEAGUE_RANKING_CATEGORIES.map((item) => <button type="button" key={item} onClick={() => setCategory(item)} className={`rounded-full px-3 py-1.5 text-xs font-bold ${item === category ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "border border-[var(--line)] text-[var(--ink-muted)]"}`}>{item}</button>)}</div></section><Card className="mt-6 overflow-hidden p-0">{loading ? <div className="grid min-h-52 place-items-center"><LoaderCircle className="animate-spin text-[var(--accent)]" /></div> : tab === "schools" ? <SchoolTable rows={sortedSchools} category={category} /> : <TeamTable rows={sortedTeams} category={category} />}</Card><p className="mt-4 text-xs leading-5 text-[var(--ink-muted)]">{category === "Overall" ? "Overall combines each published Team’s best official score per Challenge within the active season." : category === "Economic Performance" ? "Economic Performance uses the same published deterministic Challenge scores; no hidden adjustment is applied." : category === "Consistency" ? "Consistency uses the count of completed official Challenge results as a transparent participation signal." : "Official Wins counts first place in a released Official Challenge; tied top scores each receive a win."}</p></>}</main>;
}

function SchoolTable({ rows, category }: { rows: PublicLeagueSchool[]; category: LeagueRankingCategory }) {
  if (!rows.length || rows.every((row) => row.official_challenge_count === 0)) return <EmptySeason type="schools" />;
  return <div className="overflow-x-auto"><table className="w-full min-w-[660px] text-left text-sm"><thead className="border-b border-[var(--line)] bg-[var(--surface-subtle)] text-[10px] font-bold uppercase tracking-[.12em] text-[var(--ink-faint)]"><tr><th className="px-5 py-4">Rank</th><th className="px-5 py-4">School</th><th className="px-5 py-4">Teams</th><th className="px-5 py-4">Official results</th><th className="px-5 py-4 text-right">{category}</th></tr></thead><tbody>{rows.map((school, index) => <tr key={school.school_id} className="border-b border-[var(--line)] last:border-0"><td className="px-5 py-4 font-bold text-[var(--accent)]">{index + 1}</td><td className="px-5 py-4"><Link href={`/league/schools/profile/?school=${encodeURIComponent(school.school_name)}`} className="font-bold hover:text-[var(--accent)]">{school.school_name}</Link></td><td className="px-5 py-4 text-[var(--ink-muted)]">{school.team_count}</td><td className="px-5 py-4 text-[var(--ink-muted)]">{school.official_challenge_count}</td><td className="px-5 py-4 text-right font-mono font-bold">{displaySchoolMetric(school, category)}</td></tr>)}</tbody></table></div>;
}

function TeamTable({ rows, category }: { rows: PublicLeagueTeam[]; category: LeagueRankingCategory }) {
  if (!rows.length || rows.every((row) => row.official_challenge_count === 0)) return <EmptySeason type="teams" />;
  return <div className="overflow-x-auto"><table className="w-full min-w-[700px] text-left text-sm"><thead className="border-b border-[var(--line)] bg-[var(--surface-subtle)] text-[10px] font-bold uppercase tracking-[.12em] text-[var(--ink-faint)]"><tr><th className="px-5 py-4">Rank</th><th className="px-5 py-4">Team</th><th className="px-5 py-4">School</th><th className="px-5 py-4">Completed</th><th className="px-5 py-4 text-right">{category}</th></tr></thead><tbody>{rows.map((team, index) => <tr key={team.team_id} className="border-b border-[var(--line)] last:border-0"><td className="px-5 py-4 font-bold text-[var(--accent)]">{index + 1}</td><td className="px-5 py-4 font-bold">{team.team_name}</td><td className="px-5 py-4 text-[var(--ink-muted)]">{team.school_name}</td><td className="px-5 py-4 text-[var(--ink-muted)]">{team.official_challenge_count}</td><td className="px-5 py-4 text-right font-mono font-bold">{displayTeamMetric(team, category)}</td></tr>)}</tbody></table></div>;
}

function EmptySeason({ type }: { type: "schools" | "teams" }) {
  return <div className="p-8"><Trophy className="text-[var(--accent)]" size={22} /><h3 className="mt-5 text-xl font-bold">{LEAGUE_SEASON.title} standings are not open yet.</h3><p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--ink-muted)]">Official {type === "schools" ? "school" : "Team"} standings will publish when Season 1 opens and a Team submits a released Official Challenge result. Practice scores never appear here.</p><Link href="/league/season" className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-[var(--accent)]">Season details <ArrowRight size={14} /></Link></div>;
}

function IndividualsDisabled() {
  return <Card className="mt-8 p-7"><UsersRound className="text-[var(--accent)]" size={23} /><h2 className="mt-5 text-2xl font-bold">Individual standings are not enabled.</h2><p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--ink-muted)]">This League is designed around Team decision-making. Individual score aggregation is intentionally deferred, so the first season does not create a separate student leaderboard.</p></Card>;
}

function ContinuousWorldStanding({ worldLeaderboardPath }: { worldLeaderboardPath: string }) {
  return <section className="mt-8 grid gap-5 lg:grid-cols-[1.08fr_.92fr]"><Card className="p-7"><Globe2 className="text-[var(--accent)]" size={24} /><p className="mt-6 text-[10px] font-bold uppercase tracking-[.15em] text-[var(--accent)]">Independent persistent simulation</p><h2 className="mt-2 text-2xl font-bold">Continuous World rankings</h2><p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--ink-muted)]">The current country rankings, risk conditions and role contributions are maintained by the existing Continuous World system. They remain visible in League, but do not create Season 1 points.</p><Link href={worldLeaderboardPath} className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-5 py-3 text-sm font-bold text-white">Open current World ranks <ArrowRight size={15} /></Link></Card><Card className="p-7"><h3 className="text-lg font-bold">Why this is separate</h3><ul className="mt-5 space-y-3 text-sm leading-6 text-[var(--ink-muted)]"><li>• It runs continuously in natural simulated time.</li><li>• Country teams can make policy, trade and contract decisions between visits.</li><li>• Its current ranks measure national conditions and risk, not monthly Challenge points.</li></ul></Card></section>;
}

function sortSchools(rows: PublicLeagueSchool[], category: LeagueRankingCategory) {
  return [...rows].sort((left, right) => metricSchool(right, category) - metricSchool(left, category) || left.school_name.localeCompare(right.school_name));
}
function sortTeams(rows: PublicLeagueTeam[], category: LeagueRankingCategory) {
  return [...rows].sort((left, right) => metricTeam(right, category) - metricTeam(left, category) || left.team_name.localeCompare(right.team_name));
}
function metricSchool(row: PublicLeagueSchool, category: LeagueRankingCategory) { return category === "Consistency" ? row.official_challenge_count : category === "Official Wins" ? row.official_wins : row.current_season_points; }
function metricTeam(row: PublicLeagueTeam, category: LeagueRankingCategory) { return category === "Consistency" ? row.official_challenge_count : category === "Official Wins" ? row.official_wins : row.current_season_points; }
function displaySchoolMetric(row: PublicLeagueSchool, category: LeagueRankingCategory) { return category === "Consistency" ? String(row.official_challenge_count) : category === "Official Wins" ? String(row.official_wins) : row.current_season_points.toFixed(1); }
function displayTeamMetric(row: PublicLeagueTeam, category: LeagueRankingCategory) { return category === "Consistency" ? String(row.official_challenge_count) : category === "Official Wins" ? String(row.official_wins) : row.current_season_points.toFixed(1); }
