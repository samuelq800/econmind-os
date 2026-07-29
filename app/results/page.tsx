import { CompetitionSurface } from "@/components/league/competition-pages";
import { Suspense } from "react";
export default function ResultsPage() { return <Suspense fallback={null}><CompetitionSurface surface="results" /></Suspense>; }
