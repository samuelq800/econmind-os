import { WORLD_COUNTRY_IDS } from "@/lib/world-governance/config";
import { redirect } from "next/navigation";

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
  redirect(`/simulation/world/country/${countryId}`);
}
