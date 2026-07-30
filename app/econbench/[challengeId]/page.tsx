import { notFound } from "next/navigation";
import { EconBenchWorkspace } from "@/components/learning/econbench/econbench-workspace";
import {
  ECONBENCH_CHALLENGES,
  getEconBenchChallenge,
  slugForChallenge,
} from "@/lib/economics/econbench";

export function generateStaticParams() {
  return ECONBENCH_CHALLENGES.map((challenge) => ({
    challengeId: slugForChallenge(challenge.challenge_id),
  }));
}

export default async function EconBenchChallengePage({
  params,
}: {
  params: Promise<{ challengeId: string }>;
}) {
  const { challengeId } = await params;
  const challenge = getEconBenchChallenge(challengeId);
  if (!challenge) notFound();
  return <EconBenchWorkspace challenge={challenge} />;
}
