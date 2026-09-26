"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { HomeSchoolNetworkMap } from "@/components/home/home-school-network-map";
import { useLiveLeagueSchools } from "@/components/league/use-live-league-schools";

export function HomeLeagueSchoolDirectory() {
  const { schools, syncStatus } = useLiveLeagueSchools();

  const schoolCount = schools.length;

  return (
    <>
      <div className="home-section-heading">
        <div>
          <p className="home-eyebrow">Live League directory</p>
          <h2>{schoolCount} schools.<br />One world view.</h2>
        </div>
        <p className="max-w-md text-sm leading-6 text-[var(--ink-muted)]">A city-level view of the participating network. Every plotted point comes from an approved school identity and a verified city key—never from AI inference or a guessed campus address.</p>
      </div>

      <HomeSchoolNetworkMap schools={schools} syncStatus={syncStatus} />

      <div className="mt-6 flex flex-wrap gap-3">
        <Link href="/league/schools" className="home-text-link">Explore school profiles <ArrowRight size={15} /></Link>
        <Link href="/league/join" className="home-text-link">Register your school <ArrowRight size={15} /></Link>
      </div>
    </>
  );
}
