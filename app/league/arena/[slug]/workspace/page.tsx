import { LeagueChallengeWorkspace } from "@/components/league/league-challenge-workspace";
import { LEAGUE_CHALLENGE_CATALOG } from "@/lib/economics/league-arena";

export function generateStaticParams() {
  return LEAGUE_CHALLENGE_CATALOG.map(({ slug }) => ({ slug }));
}

export default async function LeagueChallengeWorkspacePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <LeagueChallengeWorkspace slug={slug} />;
}
