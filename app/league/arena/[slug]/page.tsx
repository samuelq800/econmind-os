import { LEAGUE_CHALLENGE_CATALOG } from "@/lib/economics/league-arena";
import { redirect } from "next/navigation";

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
  redirect(`/simulation/arena/${slug}`);
}
