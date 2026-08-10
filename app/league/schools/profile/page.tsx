import { Suspense } from "react";
import { LeagueSchoolProfile } from "@/components/league/league-schools";

export default function LeagueSchoolProfilePage() {
  return <Suspense fallback={<main className="min-h-[60vh]" />}><LeagueSchoolProfile /></Suspense>;
}
