import { CompetitionSurface } from "@/components/league/competition-pages";
import { Suspense } from "react";
export default function LobbyPage() { return <Suspense fallback={null}><CompetitionSurface surface="lobby" /></Suspense>; }
