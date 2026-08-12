import { Suspense } from "react";
import { LegacyCompetitionSurface } from "@/components/simulation/legacy-competition-pages";

export default function SimulationLegacyWorldLobbyPage() { return <Suspense fallback={null}><LegacyCompetitionSurface surface="lobby" /></Suspense>; }
