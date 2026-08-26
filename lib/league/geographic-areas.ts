import { allCountries } from "country-region-data";

export const LOCATION_REVIEW_STATUSES = [
  "missing",
  "pending_review",
  "verified",
  "needs_correction",
] as const;

export type LocationReviewStatus = (typeof LOCATION_REVIEW_STATUSES)[number];

export type SchoolLocationSubmission = {
  areaKey: string;
  areaLabel: string;
  administrativeArea: string;
  city: string;
};

export type CanonicalSchoolLocationInput = SchoolLocationSubmission & {
  geonameId: number;
  latitude: number;
  longitude: number;
  evidenceUrl: string;
  note: string;
};

export type CountryOrAreaOption = {
  key: string;
  label: string;
  sourceCode: string;
  administrativeAreas: string[];
};

const AREA_LABEL_OVERRIDES: Readonly<Record<string, string>> = {
  CN: "China — mainland areas",
  EH: "Western Sahara",
  FK: "Falkland Islands (Islas Malvinas)",
  HK: "Hong Kong SAR",
  MO: "Macao SAR",
  PS: "Palestinian territories",
  TW: "Taiwan",
  XK: "Kosovo",
};

const EXCLUDED_DUPLICATE_ADMIN_AREAS: Readonly<Record<string, ReadonlySet<string>>> = {
  CN: new Set(["Hong Kong", "Macau"]),
};

export function countryOrAreaKey(sourceCode: string) {
  const code = sourceCode.trim().toUpperCase();
  // These are versioned UI candidate keys, not claims that every source code
  // has a particular legal or standards status. Verification binds a school
  // to a GeoNames place, never to a sovereignty hierarchy.
  return `geoarea:${code}`;
}

const SOURCE_COUNTRY_OR_AREA_OPTIONS: CountryOrAreaOption[] = allCountries
  .map(([name, sourceCode, administrativeAreas]) => ({
    key: countryOrAreaKey(sourceCode),
    label: AREA_LABEL_OVERRIDES[sourceCode] ?? name,
    sourceCode,
    administrativeAreas: administrativeAreas
      .map(([administrativeArea]) => administrativeArea)
      .filter((administrativeArea) => !EXCLUDED_DUPLICATE_ADMIN_AREAS[sourceCode]?.has(administrativeArea)),
  }));

export const COUNTRY_OR_AREA_OPTIONS: CountryOrAreaOption[] = [
  ...SOURCE_COUNTRY_OR_AREA_OPTIONS,
  {
    key: "geoarea:ZZ",
    label: "Other or not listed area — manual review",
    sourceCode: "ZZ",
    administrativeAreas: [],
  },
]
  .sort((left, right) => left.label.localeCompare(right.label, "en", { sensitivity: "base" }));

const AREA_BY_KEY = new Map(COUNTRY_OR_AREA_OPTIONS.map((area) => [area.key, area]));

export function getCountryOrArea(areaKey: string | null | undefined) {
  return areaKey ? AREA_BY_KEY.get(areaKey) ?? null : null;
}

export function isCompleteSchoolLocation(location: SchoolLocationSubmission) {
  const area = getCountryOrArea(location.areaKey);
  if (!area || area.label !== location.areaLabel.trim() || location.city.trim().length < 2) return false;
  if (area.administrativeAreas.length > 0) {
    return area.administrativeAreas.includes(location.administrativeArea.trim());
  }
  return location.administrativeArea.trim().length <= 100;
}

export function isValidGeonameId(value: string) {
  const trimmed = value.trim();
  if (!/^[1-9][0-9]*$/.test(trimmed)) return false;
  const parsed = Number(trimmed);
  return Number.isSafeInteger(parsed) && parsed > 0;
}

export function isValidCoordinate(value: string, minimum: number, maximum: number) {
  const trimmed = value.trim();
  if (!/^[+-]?(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)$/.test(trimmed)) return false;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) && parsed >= minimum && parsed <= maximum;
}

export function isValidHttpsEvidenceUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 1000) return false;

  try {
    const url = new URL(trimmed);
    return url.protocol === "https:"
      && Boolean(url.hostname)
      && !url.username
      && !url.password;
  } catch {
    return false;
  }
}

export function isValidIndependentLocationEvidenceUrl(value: string) {
  if (!isValidHttpsEvidenceUrl(value)) return false;
  const hostname = new URL(value.trim()).hostname.toLocaleLowerCase("en-US");
  return hostname !== "geonames.org" && !hostname.endsWith(".geonames.org");
}

export const GEOGRAPHIC_LABEL_DISCLAIMER =
  "Location labels are used only for geographic indexing and do not express a position on sovereignty, borders or territorial status.";
