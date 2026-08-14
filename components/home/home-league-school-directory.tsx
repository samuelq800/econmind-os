"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { PARTICIPATING_SCHOOLS, participatingSchoolKey } from "@/lib/league/participating-schools";
import type { PublicLeagueSchool } from "@/lib/supabase/league-directory";
import { listPublicLeagueSchools } from "@/lib/supabase/league-directory";

function editorialDirectorySchool(name: string, city: string): PublicLeagueSchool {
  return {
    school_id: `editorial-${participatingSchoolKey(name)}`,
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
  };
}

function mergeHomeSchools(rows: PublicLeagueSchool[]) {
  const registered = new Map(rows.map((school) => [participatingSchoolKey(school.school_name), school]));
  const editorialRoster = PARTICIPATING_SCHOOLS.map((school) => {
    const current = registered.get(participatingSchoolKey(school.name));
    return current ? { ...current, school_name: school.name, city: current.city ?? school.city } : editorialDirectorySchool(school.name, school.city);
  });
  const editorialNames = new Set(PARTICIPATING_SCHOOLS.map((school) => participatingSchoolKey(school.name)));
  const newlyRegistered = rows.filter((school) => !editorialNames.has(participatingSchoolKey(school.school_name)));
  return [...editorialRoster, ...newlyRegistered];
}

export function HomeLeagueSchoolDirectory() {
  const [schools, setSchools] = useState<PublicLeagueSchool[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let active = true;

    void listPublicLeagueSchools()
      .then((rows) => {
        if (!active) return;
        setSchools(mergeHomeSchools(rows));
      })
      .catch(() => {
        if (!active) return;
        setLoadFailed(true);
        setSchools([]);
      });

    return () => {
      active = false;
    };
  }, []);

  const schoolCount = schools?.length ?? 0;

  return (
    <>
      <div className="home-section-heading">
        <div>
          <p className="home-eyebrow">Live League directory</p>
          <h2>{schools === null ? "A growing school network." : `${schoolCount} registered school${schoolCount === 1 ? "" : "s"}. One shared directory.`}</h2>
        </div>
        <p className="max-w-md text-sm leading-6 text-[var(--ink-muted)]">This list comes directly from the League school registry. Once a school application is approved, its public school profile appears here automatically—no separate homepage list to maintain.</p>
      </div>

      {schools === null ? (
        <div className="grid min-h-48 place-items-center border-y border-[var(--line)] text-sm text-[var(--ink-muted)]">
          <span className="inline-flex items-center gap-2"><LoaderCircle className="animate-spin text-[var(--accent)]" size={16} /> Loading registered schools…</span>
        </div>
      ) : loadFailed ? (
        <div className="mt-8 border-y border-[var(--line)] py-8 text-sm leading-6 text-[var(--ink-muted)]">The public school directory is temporarily unavailable. Please refresh to try again.</div>
      ) : schools.length === 0 ? (
        <div className="mt-8 border-y border-[var(--line)] py-8 text-sm leading-6 text-[var(--ink-muted)]">Approved League schools will appear here automatically.</div>
      ) : (
        <ol className="home-schools-grid">
          {schools.map((school, index) => {
            const detail = [school.city, school.team_count > 0 ? `${school.team_count} active team${school.team_count === 1 ? "" : "s"}` : "League school"].filter(Boolean).join(" · ");
            return <li key={school.school_id}><span>{String(index + 1).padStart(2, "0")}</span><div><h3>{school.school_name}</h3><p>{detail}</p></div></li>;
          })}
        </ol>
      )}

      <div className="mt-6 flex flex-wrap gap-3">
        <Link href="/league/schools" className="home-text-link">Explore school profiles <ArrowRight size={15} /></Link>
        <Link href="/league/join" className="home-text-link">Register your school <ArrowRight size={15} /></Link>
      </div>
    </>
  );
}
