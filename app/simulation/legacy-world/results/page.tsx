import { Suspense } from "react";
import { LegacyCompetitionSurface } from "@/components/simulation/legacy-competition-pages";

export default function SimulationLegacyWorldResultsPage() { return <Suspense fallback={null}><LegacyCompetitionSurface surface="results" /></Suspense>; }
