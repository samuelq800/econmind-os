import type { LeagueDirectorySchool } from "@/lib/league/school-directory";
import {
  SCHOOL_CITY_LOCATIONS,
  getSchoolLocationByKey,
  type CatalogSchoolCityLocation,
} from "@/lib/league/school-locations";

export const SCHOOL_NETWORK_REGIONS = [
  "East China",
  "North China",
  "South China",
  "West China",
  "Central China",
  "International",
] as const;

export type SchoolNetworkRegion = (typeof SCHOOL_NETWORK_REGIONS)[number];

export const REGION_BY_LOCATION_KEY = {
  "geonames:1816670": "North China",
  "geonames:1815286": "West China",
  "geonames:1814906": "West China",
  "geonames:1808926": "East China",
  "geonames:1805753": "East China",
  "geonames:1800163": "Central China",
  "geonames:1799962": "East China",
  "geonames:1799869": "South China",
  "geonames:1799397": "East China",
  "geonames:1797929": "East China",
  "geonames:1796236": "East China",
  "geonames:1795565": "South China",
  "geonames:1880252": "International",
  "geonames:1886760": "East China",
  "geonames:1790923": "East China",
  "geonames:1790437": "South China",
} as const satisfies Record<
  (typeof SCHOOL_CITY_LOCATIONS)[number]["locationKey"],
  SchoolNetworkRegion
>;

export type SchoolNetworkEntry = {
  school: LeagueDirectorySchool;
  location: CatalogSchoolCityLocation | null;
  region: SchoolNetworkRegion | null;
};

export type SchoolLocationHub = {
  location: CatalogSchoolCityLocation;
  region: SchoolNetworkRegion;
  schools: LeagueDirectorySchool[];
};

export type SchoolDirectoryGroup = {
  key: SchoolNetworkRegion | "unclassified";
  label: string;
  entries: SchoolNetworkEntry[];
};

const nameCollator = new Intl.Collator("en", { sensitivity: "base" });

function dedupeSchools(schools: LeagueDirectorySchool[]) {
  const unique = new Map<string, LeagueDirectorySchool>();

  for (const school of schools) {
    const identity = school.school_id.trim() || `name:${school.school_name.trim().toLocaleLowerCase()}`;
    if (!unique.has(identity)) unique.set(identity, school);
  }

  return [...unique.values()];
}

function compareEntries(left: SchoolNetworkEntry, right: SchoolNetworkEntry) {
  const cityComparison = nameCollator.compare(
    left.location?.city ?? left.school.city ?? "",
    right.location?.city ?? right.school.city ?? "",
  );

  return cityComparison || nameCollator.compare(left.school.school_name, right.school.school_name);
}

export function buildSchoolNetworkModel(inputSchools: LeagueDirectorySchool[]) {
  const schools = dedupeSchools(inputSchools);
  const hubsByLocation = new Map<string, SchoolLocationHub>();
  const entriesByRegion = new Map<SchoolNetworkRegion, SchoolNetworkEntry[]>(
    SCHOOL_NETWORK_REGIONS.map((region) => [region, []]),
  );
  const unclassifiedEntries: SchoolNetworkEntry[] = [];

  for (const school of schools) {
    const location = getSchoolLocationByKey(school.mapLocationKey);

    if (!location) {
      unclassifiedEntries.push({ school, location: null, region: null });
      continue;
    }

    const region = REGION_BY_LOCATION_KEY[location.locationKey];
    const entry = { school, location, region } satisfies SchoolNetworkEntry;
    entriesByRegion.get(region)?.push(entry);

    const currentHub = hubsByLocation.get(location.locationKey);
    if (currentHub) {
      currentHub.schools.push(school);
    } else {
      hubsByLocation.set(location.locationKey, { location, region, schools: [school] });
    }
  }

  const hubs = [...hubsByLocation.values()]
    .map((hub) => ({
      ...hub,
      schools: [...hub.schools].sort((left, right) => nameCollator.compare(left.school_name, right.school_name)),
    }))
    .sort((left, right) => right.schools.length - left.schools.length || nameCollator.compare(left.location.city, right.location.city));

  const regionGroups = SCHOOL_NETWORK_REGIONS.map((region) => ({
    key: region,
    label: region,
    entries: [...(entriesByRegion.get(region) ?? [])].sort(compareEntries),
  })).filter((group) => group.entries.length > 0) satisfies SchoolDirectoryGroup[];

  const directoryGroups: SchoolDirectoryGroup[] = [
    ...regionGroups,
    ...(unclassifiedEntries.length > 0
      ? [{
          key: "unclassified" as const,
          label: "Location pending",
          entries: [...unclassifiedEntries].sort(compareEntries),
        }]
      : []),
  ];

  return {
    schools,
    schoolCount: schools.length,
    hubs,
    mappedSchoolCount: schools.length - unclassifiedEntries.length,
    mappedCityCount: hubs.length,
    geographicRegionCount: regionGroups.length,
    unclassifiedEntries,
    regionGroups,
    directoryGroups,
  };
}
