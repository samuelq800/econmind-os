import { CompetitionSurface } from "@/components/league/competition-pages";
import { Suspense } from "react";
export default function WorldPage() { return <Suspense fallback={null}><CompetitionSurface surface="world" /></Suspense>; }
