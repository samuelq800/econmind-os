"use client";

import { useSearchParams } from "next/navigation";
import { CompetitionSurface } from "@/components/league/competition-pages";
import { ContinuousWorldDashboard } from "./continuous-world-dashboard";

/** Keeps historic League competition links working while making /world the new persistent-world landing page. */
export function WorldExperience() {
  const searchParams = useSearchParams();
  return searchParams.get("competition") ? <CompetitionSurface surface="world" /> : <ContinuousWorldDashboard />;
}
