import { Suspense } from "react";
import { LegacyCompetitionSurface } from "@/components/simulation/legacy-competition-pages";

export default function SimulationLegacyWorldRoomPage() { return <Suspense fallback={null}><LegacyCompetitionSurface surface="room" /></Suspense>; }
