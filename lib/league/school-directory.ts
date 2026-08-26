import {
  PARTICIPATING_SCHOOLS,
  participatingSchoolKey,
  type ParticipatingSchool,
} from "@/lib/league/participating-schools";
import {
  resolveSchoolLocation,
  type SchoolCityLocation,
  type SchoolLocationKey,
} from "@/lib/league/school-locations";
import type { PublicLeagueSchool } from "@/lib/supabase/league-directory";

export const DIRECTORY_SYNC_TIMEOUT_MS = 8_000;

export type LeagueDirectorySchool = PublicLeagueSchool & {
  region: ParticipatingSchool["region"] | "Unclassified";
  isEditorialOnly: boolean;
  mapLocationKey: SchoolLocationKey | null;
  mapLocation: SchoolCityLocation | null;
  locationSource: "verified-roster" | "verified-directory" | "unverified";
};

function editorialSchool(school: ParticipatingSchool): LeagueDirectorySchool {
  const location = resolveSchoolLocation(school.city);

  return {
    school_id: `editorial-${participatingSchoolKey(school.name)}`,
    school_name: school.name,
    club_name: null,
    city: school.city,
    description: null,
    logo_url: null,
    member_count: 0,
    team_count: 0,
    current_season_points: 0,
    official_challenge_count: 0,
    official_wins: 0,
    achievements: [],
    location_status: location.status === "resolved" ? "verified" : "missing",
    location_source: null,
    location_key: location.status === "resolved" ? location.location.locationKey : null,
    location_city: location.status === "resolved" ? location.location.city : null,
    location_area_key: location.status === "resolved" ? `geoarea:${location.location.countryCode}` : null,
    location_area_label: null,
    location_administrative_area: location.status === "resolved" ? location.location.administrativeArea : null,
    location_latitude: location.status === "resolved" ? location.location.latitude : null,
    location_longitude: location.status === "resolved" ? location.location.longitude : null,
    region: school.region,
    isEditorialOnly: true,
    mapLocationKey: location.status === "resolved" ? location.location.locationKey : null,
    mapLocation: location.status === "resolved" ? location.location : null,
    locationSource: location.status === "resolved" ? "verified-roster" : "unverified",
  };
}

function cleanText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function dedupeRows(rows: PublicLeagueSchool[]) {
  const rowsById = new Map<string, PublicLeagueSchool>();

  for (const row of rows) {
    const schoolName = cleanText(row.school_name);
    if (!schoolName) continue;

    const nameKey = participatingSchoolKey(schoolName);
    const schoolId = cleanText(row.school_id) ?? `runtime-${nameKey}`;
    if (rowsById.has(schoolId)) continue;

    rowsById.set(schoolId, {
      ...row,
      school_id: schoolId,
      school_name: schoolName,
      city: cleanText(row.city),
    });
  }

  return [...rowsById.values()];
}

function verifiedDirectoryLocation(row: PublicLeagueSchool): SchoolCityLocation | null {
  const locationKey = cleanText(row.location_key);
  const city = cleanText(row.location_city);
  const areaKey = cleanText(row.location_area_key);
  const areaLabel = cleanText(row.location_area_label);
  const administrativeArea = cleanText(row.location_administrative_area);

  if (
    row.location_status !== "verified"
    || !locationKey?.match(/^geonames:[1-9][0-9]{0,18}$/)
    || !city
    || city.length < 2
    || city.length > 100
    || !areaKey?.match(/^geoarea:[A-Z]{2}$/)
    || !areaLabel
    || areaLabel.length > 100
    || (administrativeArea?.length ?? 0) > 100
    || row.location_latitude == null
    || row.location_longitude == null
    || !Number.isFinite(row.location_latitude)
    || !Number.isFinite(row.location_longitude)
    || row.location_latitude < -90
    || row.location_latitude > 90
    || row.location_longitude < -180
    || row.location_longitude > 180
  ) return null;

  const geonameId = Number(locationKey.slice("geonames:".length));
  if (!Number.isSafeInteger(geonameId) || geonameId <= 0) return null;

  return {
    locationKey: locationKey as SchoolLocationKey,
    city,
    countryCode: areaKey.slice("geoarea:".length),
    areaLabel,
    administrativeArea,
    latitude: row.location_latitude,
    longitude: row.location_longitude,
    geonameId,
  };
}

export function mergeLeagueDirectory(rows: PublicLeagueSchool[]): LeagueDirectorySchool[] {
  const uniqueRows = dedupeRows(rows);
  const registeredByName = new Map<string, PublicLeagueSchool>();

  for (const row of uniqueRows) {
    const key = participatingSchoolKey(row.school_name);
    if (!registeredByName.has(key)) registeredByName.set(key, row);
  }

  const rosterKeys = new Set(PARTICIPATING_SCHOOLS.map(({ name }) => participatingSchoolKey(name)));
  const roster = PARTICIPATING_SCHOOLS.map((school) => {
    const registered = registeredByName.get(participatingSchoolKey(school.name));
    const editorial = editorialSchool(school);

    if (!registered) return editorial;

    // A verified roster location remains authoritative for the 27 reviewed
    // schools. A verified directory location may fill the one unresolved
    // roster entry, but unreviewed profile text can never move a map point.
    const directoryLocation = verifiedDirectoryLocation(registered);
    const mapLocation = editorial.mapLocation ?? directoryLocation;
    return {
      ...registered,
      school_name: school.name,
      city: editorial.mapLocation
        ? school.city
        : (directoryLocation?.city ?? cleanText(registered.city) ?? school.city),
      region: school.region,
      isEditorialOnly: false,
      mapLocationKey: mapLocation?.locationKey ?? null,
      mapLocation,
      locationSource: editorial.mapLocation
        ? "verified-roster"
        : (directoryLocation ? "verified-directory" : "unverified"),
    } satisfies LeagueDirectorySchool;
  });

  const additional = uniqueRows
    .filter((row) => !rosterKeys.has(participatingSchoolKey(row.school_name)))
    .map((row) => {
      const mapLocation = verifiedDirectoryLocation(row);
      return {
        ...row,
        region: "Unclassified" as const,
        isEditorialOnly: false,
        mapLocationKey: mapLocation?.locationKey ?? null,
        mapLocation,
        locationSource: mapLocation ? "verified-directory" as const : "unverified" as const,
      };
    })
    .sort((left, right) => left.school_name.localeCompare(right.school_name, "en"));

  return [...roster, ...additional];
}

export function withDirectorySyncTimeout<T>(
  operation: Promise<T>,
  timeoutMs = DIRECTORY_SYNC_TIMEOUT_MS,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("League directory sync timed out.")), timeoutMs);

    operation.then(resolve, reject).finally(() => clearTimeout(timer));
  });
}
