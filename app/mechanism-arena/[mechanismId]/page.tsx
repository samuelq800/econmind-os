import { notFound } from "next/navigation";
import { AuctionExperimentWorkspace } from "@/components/mechanism-arena/auction-workspace";
import { GenericMechanismWorkspace } from "@/components/mechanism-arena/generic-workspace";
import { getMechanismScenario, mechanismScenarios } from "@/lib/mechanism-arena/catalog";

export const dynamicParams = false;

export function generateStaticParams() {
  return mechanismScenarios.map((scenario) => ({ mechanismId: scenario.scenario_id }));
}

export default async function MechanismExperimentPage({ params }: { params: Promise<{ mechanismId: string }> }) {
  const { mechanismId } = await params;
  const scenario = getMechanismScenario(mechanismId);
  if (!scenario) notFound();
  if (scenario.scenario_id === "MA-01-FIRST-PRICE" || scenario.scenario_id === "MA-02-SECOND-PRICE") return <AuctionExperimentWorkspace scenario={scenario} />;
  return <GenericMechanismWorkspace scenario={scenario} />;
}
