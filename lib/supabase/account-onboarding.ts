import {
  requireSupabaseBrowserClient as client,
  throwIfSupabaseError as fail,
} from "./client";
import type { CurriculumSystem } from "@/lib/league/curriculum";
import type { SchoolLocationSubmission } from "@/lib/league/geographic-areas";

export type OnboardingPath = "school" | "create_school" | "visitor";
export type OnboardingProfile = { onboarding_path: OnboardingPath | null; school_id: string | null };
export type ApprovedSchoolChoice = { id: string; name: string; club_name: string | null; city: string | null };

export async function getAccountOnboarding() {
  const { data, error } = await client().from("profiles").select("onboarding_path,school_id").maybeSingle();
  fail(error);
  return data as OnboardingProfile | null;
}

export async function listApprovedSchoolChoices() {
  const { data, error } = await client().rpc("list_approved_econmind_schools");
  fail(error);
  return (data ?? []) as ApprovedSchoolChoice[];
}

export async function completeAccountOnboarding(input: { path: OnboardingPath; schoolId?: string | null; schoolName?: string; clubName?: string; curriculumSystem?: CurriculumSystem; location?: SchoolLocationSubmission }) {
  const { data, error } = await client().rpc("complete_econmind_onboarding", {
    p_path: input.path,
    p_school_id: input.schoolId ?? null,
    p_school_name: input.schoolName ?? null,
    p_club_name: input.clubName ?? null,
    p_curriculum_system: input.curriculumSystem ?? null,
    p_submitted_area_key: input.location?.areaKey ?? null,
    p_submitted_area_label: input.location?.areaLabel ?? null,
    p_submitted_administrative_area: input.location?.administrativeArea ?? null,
    p_submitted_city: input.location?.city ?? null,
  });
  fail(error);
  return data as { path: OnboardingPath; school_id?: string; school_name?: string; application_id?: string; status?: string };
}
