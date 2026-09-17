import { notFound, redirect } from "next/navigation";
import {
  WORLD_COUNTRY_IDS,
  WORLD_OFFICE_PATHS,
} from "@/lib/world-governance/config";

export const dynamicParams = false;

export function generateStaticParams() {
  return WORLD_COUNTRY_IDS.flatMap((countryId) =>
    WORLD_OFFICE_PATHS.map((office) => ({ countryId, office })),
  );
}

export default async function CountryOfficeWorldPage({
  params,
}: {
  params: Promise<{ countryId: string; office: string }>;
}) {
  const { countryId, office } = await params;
  if (
    !WORLD_COUNTRY_IDS.includes(countryId) ||
    !WORLD_OFFICE_PATHS.includes(office as (typeof WORLD_OFFICE_PATHS)[number])
  )
    notFound();
  redirect(`/simulation/world/country/${countryId}/${office}`);
}
