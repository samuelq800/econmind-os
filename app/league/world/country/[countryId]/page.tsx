import { CountrySimulationWorkspace } from "@/components/world-governance/world-simulation";
import { WORLD_COUNTRY_IDS } from "@/lib/world-governance/config";

export const dynamicParams = false;

export function generateStaticParams() {
  return WORLD_COUNTRY_IDS.map((countryId) => ({ countryId }));
}

export default async function CountryWorldPage({
  params,
}: {
  params: Promise<{ countryId: string }>;
}) {
  const { countryId } = await params;
  return <CountrySimulationWorkspace countryId={countryId} />;
}
