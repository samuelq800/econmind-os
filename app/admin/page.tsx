import { CompetitionSurface } from "@/components/league/competition-pages";
import { Suspense } from "react";
export default function LeagueAdminPage() { return <Suspense fallback={null}><CompetitionSurface surface="admin" /></Suspense>; }
