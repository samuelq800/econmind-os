import { notFound } from "next/navigation";
import { WorldOfficeWorkspace } from "@/components/world-governance/world-simulation";
import { WORLD_COUNTRY_IDS, WORLD_OFFICE_PATHS } from "@/lib/world-governance/config";
import type { WorldGovernanceOffice } from "@/lib/world-governance/types";

export const dynamicParams = false;

export function generateStaticParams() {
  return WORLD_COUNTRY_IDS.flatMap((countryId) =>
    WORLD_OFFICE_PATHS.map((office) => ({ countryId, office })),
  );
}

export default async function SimulationCountryOfficePage({
  params,
}: {
  params: Promise<{ countryId: string; office: string }>;
}) {
  const { countryId, office } = await params;
  if (!WORLD_COUNTRY_IDS.includes(countryId) || !WORLD_OFFICE_PATHS.includes(office as (typeof WORLD_OFFICE_PATHS)[number])) notFound();
  return <WorldOfficeWorkspace countryId={countryId} office={office as WorldGovernanceOffice} basePath="/simulation/world" />;
}
