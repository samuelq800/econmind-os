import { Suspense } from "react";
import { LegacyCompetitionSurface } from "@/components/simulation/legacy-competition-pages";

export default function SimulationLegacyWorldWorldPage() { return <Suspense fallback={null}><LegacyCompetitionSurface surface="world" /></Suspense>; }
