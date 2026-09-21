"use client";

import { useEffect, useState } from "react";
import {
  mergeLeagueDirectory,
  withDirectorySyncTimeout,
  type LeagueDirectorySchool,
} from "@/lib/league/school-directory";
import { listPublicLeagueSchools } from "@/lib/supabase/league-directory";

export type LeagueDirectorySyncStatus = "syncing" | "live" | "fallback";

/**
 * The public homepage and League About page intentionally use this one live
 * directory source so every displayed school total has the same meaning.
 */
export function useLiveLeagueSchools() {
  const [schools, setSchools] = useState<LeagueDirectorySchool[]>(() => mergeLeagueDirectory([]));
  const [syncStatus, setSyncStatus] = useState<LeagueDirectorySyncStatus>("syncing");

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

  return { schools, syncStatus };
}
