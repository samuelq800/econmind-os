import { describe, expect, it } from "vitest";
import { prefillAcademicSchoolLocation } from "@/lib/competition/school-prefill";
import type { AcademicProfile } from "@/lib/supabase/competition-matching";

const academic: AcademicProfile = {
  country: "Old region",
  location: "Old city",
  curriculum: "IB",
  curriculum_detail: {},
  graduation_year: null,
  gpa: null,
  gpa_scale: "",
  gpa_system: "",
  english_tests: [],
  standardized_tests: [],
  amc_records: [],
  competition_records: [],
  visibility: {},
  bio: "",
};

describe("competition school prefill", () => {
  it("uses registered school location while preserving academic fields", () => {
    expect(prefillAcademicSchoolLocation(academic, {
      city: "Suzhou",
      area: "China — mainland areas",
    })).toMatchObject({
      location: "Suzhou",
      country: "China — mainland areas",
      curriculum: "IB",
    });
  });

  it("keeps manually entered locations when the school has no verified data", () => {
    expect(prefillAcademicSchoolLocation(academic, { city: null, area: null })).toEqual(academic);
  });
});
