import {
  PARTICIPATING_SCHOOLS,
  participatingSchoolKey,
  type ParticipatingSchool,
} from "@/lib/league/participating-schools";
import {
  resolveSchoolLocation,
  type SchoolLocationKey,
} from "@/lib/league/school-locations";
import type { PublicLeagueSchool } from "@/lib/supabase/league-directory";

export const DIRECTORY_SYNC_TIMEOUT_MS = 8_000;

export type LeagueDirectorySchool = PublicLeagueSchool & {
  region: ParticipatingSchool["region"] | "Unclassified";
  isEditorialOnly: boolean;
  mapLocationKey: SchoolLocationKey | null;
  locationSource: "verified-roster" | "unverified";
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
    region: school.region,
    isEditorialOnly: true,
    mapLocationKey: location.status === "resolved" ? location.location.locationKey : null,
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

    // A verified roster location is the map authority. Live profile text can
    // enrich the card, but cannot silently move an existing school because of
    // an empty, misspelled or same-named city value.
    return {
      ...registered,
      school_name: school.name,
      city: editorial.mapLocationKey ? school.city : (cleanText(registered.city) ?? school.city),
      region: school.region,
      isEditorialOnly: false,
      mapLocationKey: editorial.mapLocationKey,
      locationSource: editorial.locationSource,
    } satisfies LeagueDirectorySchool;
  });

  const additional = uniqueRows
    .filter((row) => !rosterKeys.has(participatingSchoolKey(row.school_name)))
    .map((row) => ({
      ...row,
      region: "Unclassified" as const,
      isEditorialOnly: false,
      // Current public rows have only a free-text city. Even an exact city
      // label can be ambiguous globally, so new rows stay off-map until the
      // registration workflow supplies a reviewed location key.
      mapLocationKey: null,
      locationSource: "unverified" as const,
    }))
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
