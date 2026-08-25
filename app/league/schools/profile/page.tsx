import type { Metadata } from "next";
import { Suspense } from "react";
import { LeagueSchoolProfile } from "@/components/league/league-schools";

export const metadata: Metadata = {
  robots: { index: false, follow: true },
};

export default function LeagueSchoolProfilePage() {
  return (
    <Suspense fallback={<main className="min-h-[60vh]" />}>
      <LeagueSchoolProfile />
    </Suspense>
  );
}
