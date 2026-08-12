import { Suspense } from "react";
import { LegacyCompetitionSurface } from "@/components/simulation/legacy-competition-pages";

export default function SimulationLegacyWorldReplayPage() { return <Suspense fallback={null}><LegacyCompetitionSurface surface="replay" /></Suspense>; }
