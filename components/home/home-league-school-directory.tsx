"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { HomeSchoolNetworkMap } from "@/components/home/home-school-network-map";
import {
  mergeLeagueDirectory,
  withDirectorySyncTimeout,
  type LeagueDirectorySchool,
} from "@/lib/league/school-directory";
import { listPublicLeagueSchools } from "@/lib/supabase/league-directory";

export function HomeLeagueSchoolDirectory() {
  const [schools, setSchools] = useState<LeagueDirectorySchool[]>(() => mergeLeagueDirectory([]));
  const [syncStatus, setSyncStatus] = useState<"syncing" | "live" | "fallback">("syncing");

  useEffect(() => {
    let active = true;
    let inFlight = false;

    const sync = async () => {
      if (!active || inFlight) return;
      inFlight = true;
      try {
        const rows = await withDirectorySyncTimeout(listPublicLeagueSchools());
        if (!active) return;
        setSchools(mergeLeagueDirectory(rows));
        setSyncStatus("live");
      } catch {
        if (!active) return;
        setSyncStatus("fallback");
      } finally {
        inFlight = false;
      }
    };

    const syncWhenVisible = () => {
      if (document.visibilityState === "visible") void sync();
    };

    void sync();
    window.addEventListener("focus", syncWhenVisible);
    window.addEventListener("online", syncWhenVisible);
    document.addEventListener("visibilitychange", syncWhenVisible);

    return () => {
      active = false;
      window.removeEventListener("focus", syncWhenVisible);
      window.removeEventListener("online", syncWhenVisible);
      document.removeEventListener("visibilitychange", syncWhenVisible);
    };
  }, []);

  const schoolCount = schools.length;

  return (
    <>
      <div className="home-section-heading">
        <div>
          <p className="home-eyebrow">Live League directory</p>
          <h2>{schoolCount} schools.<br />One world view.</h2>
        </div>
        <p className="max-w-md text-sm leading-6 text-[var(--ink-muted)]">A city-level view of the participating network. Every plotted point comes from a reviewed roster identity and a verified city key—never from AI inference or a guessed campus address.</p>
      </div>

      <HomeSchoolNetworkMap schools={schools} syncStatus={syncStatus} />

      <div className="mt-6 flex flex-wrap gap-3">
        <Link href="/league/schools" className="home-text-link">Explore school profiles <ArrowRight size={15} /></Link>
        <Link href="/league/join" className="home-text-link">Register your school <ArrowRight size={15} /></Link>
      </div>
    </>
  );
}
