import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  COUNTRY_OR_AREA_OPTIONS,
  GEOGRAPHIC_LABEL_DISCLAIMER,
  canonicalLocationFromCatalogEntry,
  getCountryOrArea,
  isCompleteSchoolLocation,
  isValidCoordinate,
  isValidGeonameId,
  isValidHttpsEvidenceUrl,
  isValidIndependentLocationEvidenceUrl,
} from "@/lib/league/geographic-areas";

const migration = readFileSync("supabase/migrations/20260826000000_school_location_review_workflow.sql", "utf8");
const onboarding = readFileSync("components/auth/account-onboarding.tsx", "utf8");
const join = readFileSync("components/league/join-league.tsx", "utf8");
const locationFields = readFileSync("components/league/school-location-fields.tsx", "utf8");
const adminReview = readFileSync("components/league/application-location-review.tsx", "utf8");
const schoolReview = readFileSync("components/league/school-location-review.tsx", "utf8");
const existingLocationMatch = readFileSync("components/league/existing-location-match.tsx", "utf8");
const dashboard = readFileSync("components/league/league-dashboard.tsx", "utf8");
const leagueClient = readFileSync("lib/supabase/league.ts", "utf8");
const publicDirectory = readFileSync("lib/supabase/league-directory.ts", "utf8");
const curriculumMigration = readFileSync("supabase/migrations/20260817000000_school_curriculum_systems.sql", "utf8");
const pagesWorkflow = readFileSync(".github/workflows/deploy-pages.yml", "utf8");

describe("school location review workflow", () => {
  it("treats the global list as neutral geographic candidates rather than sovereignty data", () => {
    const keys = COUNTRY_OR_AREA_OPTIONS.map(({ key }) => key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.every((key) => /^geoarea:[A-Z]{2}$/.test(key))).toBe(true);
    expect(getCountryOrArea("geoarea:CN")?.label).toBe("China — mainland areas");
    expect(getCountryOrArea("geoarea:HK")?.label).toBe("Hong Kong SAR");
    expect(getCountryOrArea("geoarea:MO")?.label).toBe("Macao SAR");
    expect(getCountryOrArea("geoarea:PS")?.label).toBe("Palestinian territories");
    expect(getCountryOrArea("geoarea:TW")?.label).toBe("Taiwan");
    expect(getCountryOrArea("geoarea:FK")?.label).toBe("Falkland Islands (Islas Malvinas)");
    expect(getCountryOrArea("geoarea:CN")?.administrativeAreas).not.toContain("Hong Kong");
    expect(getCountryOrArea("geoarea:CN")?.administrativeAreas).not.toContain("Macau");
    expect(getCountryOrArea("geoarea:ZZ")?.label).toContain("manual review");
    expect(GEOGRAPHIC_LABEL_DISCLAIMER).toContain("do not express a position on sovereignty");
    expect(locationFields).toContain("Country or area");
    expect(locationFields).not.toContain("flag");
  });

  it("rejects blank, coerced or malformed canonical review values", () => {
    expect(isValidGeonameId("1816670")).toBe(true);
    expect(isValidGeonameId("1e3")).toBe(false);
    expect(isValidGeonameId("9007199254740992")).toBe(false);
    expect(isValidCoordinate("0", -90, 90)).toBe(true);
    expect(isValidCoordinate("", -90, 90)).toBe(false);
    expect(isValidCoordinate("Infinity", -90, 90)).toBe(false);
    expect(isValidCoordinate("91", -90, 90)).toBe(false);
    expect(isValidHttpsEvidenceUrl("https://school.example/location")).toBe(true);
    expect(isValidHttpsEvidenceUrl("https://")).toBe(false);
    expect(isValidHttpsEvidenceUrl("https://user:secret@school.example/")).toBe(false);
    expect(isValidIndependentLocationEvidenceUrl("https://school.example/location")).toBe(true);
    expect(isValidIndependentLocationEvidenceUrl("https://www.geonames.org/1816670/")).toBe(false);
  });

  it("requires an explicit, lossless reuse of an existing GeoNames catalog record", () => {
    const catalogEntry = {
      locationKey: "geonames:1886760",
      geonameId: 1886760,
      areaKey: "geoarea:CN",
      areaLabel: "China — mainland areas",
      administrativeArea: "Jiangsu",
      city: "Suzhou",
      latitude: 31.30408,
      longitude: 120.59538,
    };

    expect(canonicalLocationFromCatalogEntry(catalogEntry, " https://school.example/about ", " checked ")).toEqual({
      areaKey: "geoarea:CN",
      areaLabel: "China — mainland areas",
      administrativeArea: "Jiangsu",
      city: "Suzhou",
      geonameId: 1886760,
      latitude: 31.30408,
      longitude: 120.59538,
      evidenceUrl: "https://school.example/about",
      note: "checked",
    });
    expect(leagueClient).toContain('.from("school_location_catalog")');
    expect(leagueClient).toContain('.eq("geoname_id", geonameId)');
    expect(existingLocationMatch).toContain("Use catalog record");
    expect(existingLocationMatch).toContain("Open GeoNames");
    expect(schoolReview).toContain("Search GeoNames");
    expect(schoolReview).toContain("Check GeoNames ID");
    expect(adminReview).toContain("URL number");
  });

  it("keeps location review panels open when a save fails", () => {
    expect(schoolReview).toContain("if (saved) setOpen(false)");
    expect(adminReview).toContain("if (saved) setMode(null)");
    expect(dashboard).toContain("return false");
  });

  it("requires area, applicable administrative area and a city in both registration entry points", () => {
    const complete = {
      areaKey: "geoarea:CN",
      areaLabel: "China — mainland areas",
      administrativeArea: "Jiangsu",
      city: "Suzhou",
    };
    expect(isCompleteSchoolLocation(complete)).toBe(true);
    expect(isCompleteSchoolLocation({ ...complete, administrativeArea: "" })).toBe(false);
    expect(isCompleteSchoolLocation({ ...complete, areaKey: "geoarea:XX" })).toBe(false);
    expect(isCompleteSchoolLocation({ ...complete, city: " " })).toBe(false);
    expect(onboarding).toContain("SchoolLocationFields");
    expect(join).toContain("SchoolLocationFields");
    expect(join).toContain("isCompleteSchoolLocation(form.location)");
  });

  it("forces application writes through server-owned RPC state", () => {
    expect(leagueClient).toContain('.rpc("submit_league_application"');
    expect(leagueClient).not.toContain('.from("league_applications").insert');
    expect(migration).toContain("applicant_user_id = auth.uid()");
    expect(migration).toContain("clean_city, 'pending_review'");
    expect(migration).toContain("You already have an active school application");
    expect(migration).toContain("league_applications_one_active_per_applicant_idx");
    expect(migration).toContain("pg_advisory_xact_lock");
    expect(migration).toContain("revoke insert, update, delete on public.league_applications from authenticated, anon");
    expect(migration).toContain("revoke insert, update, delete on public.schools from authenticated, anon");
    expect(migration).toContain("drop function if exists public.complete_econmind_onboarding(text, uuid, text, text, text)");
  });

  it("keeps school approval and location review as separate guarded state machines", () => {
    for (const status of ["missing", "pending_review", "verified", "needs_correction"]) {
      expect(migration).toContain(`'${status}'`);
    }
    expect(migration).toContain("Verify the school location before approving this application");
    expect(migration).toContain("select * into application from public.league_applications where id = p_application_id for update");
    expect(migration).toContain("school_location_review_events");
    expect(migration).toContain("Platform administrator role required");
    expect(migration).toContain("Only a pending location can use exact catalog matching");
    expect(migration).not.toContain("application.submitted_administrative_area is null\n      or");
    expect(migration).toContain("public.econmind_location_text_key(catalog.administrative_area)\n      = public.econmind_location_text_key(application.submitted_administrative_area)");
    expect(migration).toContain("request_league_school_location_correction");
    expect(migration).toContain("independent HTTPS school or institutional evidence URL");
    expect(adminReview).toContain("Match verified city");
    expect(adminReview).toContain("Exact catalog matching only resolves the city record");
    expect(adminReview).toContain("Request correction");
    expect(dashboard).toContain('application.location_status !== "verified"');
    expect(dashboard).toContain("Pending school locations");
    expect(dashboard.indexOf('{role === "platform_admin" && (')).toBeLessThan(dashboard.indexOf("Pending school locations"));
    expect(adminReview).toContain('application.status === "submitted" || application.status === "under_review"');
  });

  it("publishes and plots canonical locations only after verification", () => {
    expect(migration).toContain("case when school.location_status = 'verified' then location.location_key else null end");
    expect(migration).toContain("latitude between -90 and 90");
    expect(migration).toContain("longitude between -180 and 180");
    expect(migration).toContain("p_latitude::text in ('NaN', 'Infinity', '-Infinity')");
    expect(publicDirectory).toContain('rpc("get_public_league_directory_v2")');
    expect(publicDirectory).toContain('location_status: legacyResponse ? "missing"');
  });

  it("keeps clean migration replay independent of functions created out of band", () => {
    const helperDefinition = curriculumMigration.indexOf("create or replace function public.econmind_school_identity_key");
    const reviewDefinition = curriculumMigration.indexOf("create or replace function public.review_league_application");
    expect(helperDefinition).toBeGreaterThan(-1);
    expect(helperDefinition).toBeLessThan(reviewDefinition);
  });

  it("blocks a frontend-first production rollout when the required backend schema is absent", () => {
    expect(pagesWorkflow).toContain("Verify required Supabase schema");
    expect(pagesWorkflow).toContain("/rest/v1/rpc/get_public_league_directory_v2");
    expect(pagesWorkflow).toContain("curl --fail");
  });
});
