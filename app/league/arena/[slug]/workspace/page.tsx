import { LEAGUE_CHALLENGE_CATALOG } from "@/lib/economics/league-arena";
import { redirect } from "next/navigation";

export function generateStaticParams() {
  return LEAGUE_CHALLENGE_CATALOG.map(({ slug }) => ({ slug }));
}

export default async function LeagueChallengeWorkspacePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  redirect(`/simulation/arena/${slug}/workspace`);
}
