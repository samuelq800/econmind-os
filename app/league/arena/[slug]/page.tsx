import { LeagueChallengeWorkspace } from "@/components/league/league-challenge-workspace";
import { LEAGUE_CHALLENGE_CATALOG } from "@/lib/economics/league-arena";

export const dynamicParams = false;

export function generateStaticParams() {
  return LEAGUE_CHALLENGE_CATALOG.map((challenge) => ({ slug: challenge.slug }));
}

export default async function LeagueChallengePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <LeagueChallengeWorkspace slug={slug} />;
}
