import catalog from "./country-catalog.json";

export const season1Countries = catalog.countries;
export const WORLD_URL = "https://world.econmind.group";
export const countryByCode = (code: string | null | undefined) =>
  season1Countries.find((country) => country.code === code);
export const normalizeCountryCode = (value: string) =>
  /^\d{1,2}$/.test(value.trim()) && Number(value) >= 1 && Number(value) <= 70
    ? value.trim().padStart(2, "0")
    : null;

export type CountryPreferenceView = {
  seasonId: string;
  serverNow: string;
  myTeam: null | {
    id: string;
    name: string;
    memberCount: number;
    recruitmentLocked: boolean;
    isCaptain: boolean;
    eligible: boolean;
    preference: null | { code: string; selectedAt: string };
  };
  countries: { code: string; reserved: boolean; selectedByMyTeam: boolean }[];
};
