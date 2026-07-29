import { CompetitionSurface } from "@/components/league/competition-pages";
import { Suspense } from "react";
export default function RoomPage() { return <Suspense fallback={null}><CompetitionSurface surface="room" /></Suspense>; }
