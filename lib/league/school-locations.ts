export type SchoolLocationKey = `geonames:${number}`;

export type SchoolCityLocation = Readonly<{
  locationKey: SchoolLocationKey;
  city: string;
  countryCode: string;
  areaLabel?: string | null;
  administrativeArea: string | null;
  latitude: number;
  longitude: number;
  geonameId: number;
}>;

export const SCHOOL_LOCATION_SOURCE = {
  name: "GeoNames",
  dataset: "cities15000",
  snapshotDate: "2026-08-30",
  downloadUrl: "https://download.geonames.org/export/dump/cities15000.zip",
  documentationUrl: "https://download.geonames.org/export/dump/",
  license: "CC BY 4.0",
  licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
  coordinateReferenceSystem: "WGS84",
} as const;

// Frozen from the GeoNames cities15000 snapshot above. Records were selected
// by exact city name and country code. Where a name matched multiple records
// inside China (Suzhou, Wuxi and Zhuhai), the most populous exact-name record
// was selected. GeoNames IDs are retained so every coordinate is auditable.
// This catalog is deliberately explicit: unknown labels must not be geocoded,
// fuzzy-matched or inferred at runtime.
export const SCHOOL_CITY_LOCATIONS = [
  {
    locationKey: "geonames:2158177",
    city: "Melbourne",
    countryCode: "AU",
    administrativeArea: "Victoria",
    latitude: -37.814,
    longitude: 144.96332,
    geonameId: 2158177,
  },
  {
    locationKey: "geonames:1816670",
    city: "Beijing",
    countryCode: "CN",
    administrativeArea: "Beijing",
    latitude: 39.9075,
    longitude: 116.39723,
    geonameId: 1816670,
  },
  {
    locationKey: "geonames:1815456",
    city: "Changzhou",
    countryCode: "CN",
    administrativeArea: "Jiangsu",
    latitude: 31.77359,
    longitude: 119.95401,
    geonameId: 1815456,
  },
  {
    locationKey: "geonames:1815286",
    city: "Chengdu",
    countryCode: "CN",
    administrativeArea: "Sichuan",
    latitude: 30.66667,
    longitude: 104.06667,
    geonameId: 1815286,
  },
  {
    locationKey: "geonames:1814906",
    city: "Chongqing",
    countryCode: "CN",
    administrativeArea: "Chongqing",
    latitude: 29.56026,
    longitude: 106.55771,
    geonameId: 1814906,
  },
  {
    locationKey: "geonames:1810845",
    city: "Foshan",
    countryCode: "CN",
    administrativeArea: "Guangdong",
    latitude: 23.02677,
    longitude: 113.13148,
    geonameId: 1810845,
  },
  {
    locationKey: "geonames:1809858",
    city: "Guangzhou",
    countryCode: "CN",
    administrativeArea: "Guangdong",
    latitude: 23.11667,
    longitude: 113.25,
    geonameId: 1809858,
  },
  {
    locationKey: "geonames:1808722",
    city: "Hefei",
    countryCode: "CN",
    administrativeArea: "Anhui",
    latitude: 31.86389,
    longitude: 117.28083,
    geonameId: 1808722,
  },
  {
    locationKey: "geonames:1819729",
    city: "Hong Kong",
    countryCode: "HK",
    administrativeArea: null,
    latitude: 22.27832,
    longitude: 114.17469,
    geonameId: 1819729,
  },
  {
    locationKey: "geonames:1808926",
    city: "Hangzhou",
    countryCode: "CN",
    administrativeArea: "Zhejiang",
    latitude: 30.29365,
    longitude: 120.16142,
    geonameId: 1808926,
  },
  {
    locationKey: "geonames:1805753",
    city: "Jinan",
    countryCode: "CN",
    administrativeArea: "Shandong",
    latitude: 36.66833,
    longitude: 116.99722,
    geonameId: 1805753,
  },
  {
    locationKey: "geonames:1800163",
    city: "Nanchang",
    countryCode: "CN",
    administrativeArea: "Jiangxi",
    latitude: 28.68396,
    longitude: 115.85306,
    geonameId: 1800163,
  },
  {
    locationKey: "geonames:1799962",
    city: "Nanjing",
    countryCode: "CN",
    administrativeArea: "Jiangsu",
    latitude: 32.06167,
    longitude: 118.77778,
    geonameId: 1799962,
  },
  {
    locationKey: "geonames:1799869",
    city: "Nanning",
    countryCode: "CN",
    administrativeArea: "Guangxi",
    latitude: 22.81667,
    longitude: 108.31667,
    geonameId: 1799869,
  },
  {
    locationKey: "geonames:1799397",
    city: "Ningbo",
    countryCode: "CN",
    administrativeArea: "Zhejiang",
    latitude: 29.87819,
    longitude: 121.54945,
    geonameId: 1799397,
  },
  {
    locationKey: "geonames:1797929",
    city: "Qingdao",
    countryCode: "CN",
    administrativeArea: "Shandong",
    latitude: 36.06488,
    longitude: 120.38042,
    geonameId: 1797929,
  },
  {
    locationKey: "geonames:1796236",
    city: "Shanghai",
    countryCode: "CN",
    administrativeArea: "Shanghai",
    latitude: 31.22222,
    longitude: 121.45806,
    geonameId: 1796236,
  },
  {
    locationKey: "geonames:1795855",
    city: "Shijiazhuang",
    countryCode: "CN",
    administrativeArea: "Hebei",
    latitude: 38.04139,
    longitude: 114.47861,
    geonameId: 1795855,
  },
  {
    locationKey: "geonames:1795565",
    city: "Shenzhen",
    countryCode: "CN",
    administrativeArea: "Guangdong",
    latitude: 22.54554,
    longitude: 114.0683,
    geonameId: 1795565,
  },
  {
    locationKey: "geonames:1880252",
    city: "Singapore",
    countryCode: "SG",
    administrativeArea: null,
    latitude: 1.28967,
    longitude: 103.85007,
    geonameId: 1880252,
  },
  {
    locationKey: "geonames:1886760",
    city: "Suzhou",
    countryCode: "CN",
    administrativeArea: "Jiangsu",
    latitude: 31.30408,
    longitude: 120.59538,
    geonameId: 1886760,
  },
  {
    locationKey: "geonames:1790923",
    city: "Wuxi",
    countryCode: "CN",
    administrativeArea: "Jiangsu",
    latitude: 31.56887,
    longitude: 120.28857,
    geonameId: 1790923,
  },
  {
    locationKey: "geonames:1790437",
    city: "Zhuhai",
    countryCode: "CN",
    administrativeArea: "Guangdong",
    latitude: 22.27694,
    longitude: 113.56778,
    geonameId: 1790437,
  },
  {
    locationKey: "geonames:1806408",
    city: "Yangjiang",
    countryCode: "CN",
    administrativeArea: "Guangdong",
    latitude: 21.85563,
    longitude: 111.96272,
    geonameId: 1806408,
  },
  {
    locationKey: "geonames:1790630",
    city: "Xi'an",
    countryCode: "CN",
    administrativeArea: "Shaanxi",
    latitude: 34.25833,
    longitude: 108.92861,
    geonameId: 1790630,
  },
] as const satisfies readonly SchoolCityLocation[];

const NON_GEOGRAPHIC_CITY_LABELS = new Set(["league partner"]);

function normaliseCityLabel(city: string) {
  return city.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US");
}

const LOCATION_BY_CITY = new Map(
  SCHOOL_CITY_LOCATIONS.map((location) => [normaliseCityLabel(location.city), location] as const),
);

const LOCATION_BY_KEY = new Map(
  SCHOOL_CITY_LOCATIONS.map((location) => [location.locationKey, location] as const),
);

export type CatalogSchoolCityLocation = (typeof SCHOOL_CITY_LOCATIONS)[number];

export function getSchoolLocationByKey(
  locationKey: SchoolLocationKey | null | undefined,
): CatalogSchoolCityLocation | null {
  if (!locationKey) return null;
  return LOCATION_BY_KEY.get(locationKey as CatalogSchoolCityLocation["locationKey"]) ?? null;
}

export function schoolLocationAreaLabel(location: SchoolCityLocation) {
  if (location.areaLabel?.trim()) return location.areaLabel.trim();
  if (location.countryCode === "CN") return "China — mainland areas";
  if (location.countryCode === "SG") return "Singapore";
  if (location.countryCode === "HK") return "Hong Kong SAR";
  if (location.countryCode === "AU") return "Australia";
  return "Other location";
}

export type SchoolLocationResolution =
  | Readonly<{
      status: "resolved";
      location: SchoolCityLocation;
    }>
  | Readonly<{
      status: "unresolved";
      input: string | null;
      reason: "missing-city" | "non-geographic-label" | "unrecognised-city";
    }>;

export function resolveSchoolLocation(city: string | null | undefined): SchoolLocationResolution {
  if (city == null || city.trim() === "") {
    return { status: "unresolved", input: city ?? null, reason: "missing-city" };
  }

  const normalisedCity = normaliseCityLabel(city);

  if (NON_GEOGRAPHIC_CITY_LABELS.has(normalisedCity)) {
    return { status: "unresolved", input: city, reason: "non-geographic-label" };
  }

  const location = LOCATION_BY_CITY.get(normalisedCity);

  return location
    ? { status: "resolved", location }
    : { status: "unresolved", input: city, reason: "unrecognised-city" };
}
