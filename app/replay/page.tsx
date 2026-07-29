import { CompetitionSurface } from "@/components/league/competition-pages";
import { Suspense } from "react";
export default function ReplayPage() { return <Suspense fallback={null}><CompetitionSurface surface="replay" /></Suspense>; }
