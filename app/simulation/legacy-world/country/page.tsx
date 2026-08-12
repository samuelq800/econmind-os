import { Suspense } from "react";
import { LegacyCompetitionSurface } from "@/components/simulation/legacy-competition-pages";

export default function SimulationLegacyWorldCountryPage() { return <Suspense fallback={null}><LegacyCompetitionSurface surface="country" /></Suspense>; }
