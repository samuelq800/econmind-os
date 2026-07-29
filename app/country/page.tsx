import { CompetitionSurface } from "@/components/league/competition-pages";
import { Suspense } from "react";
export default function CountryPage() { return <Suspense fallback={null}><CompetitionSurface surface="country" /></Suspense>; }
