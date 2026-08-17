import { getSupabaseBrowserClient } from "./client";
import type { CurriculumSystem } from "@/lib/league/curriculum";

export type OnboardingPath = "school" | "create_school" | "visitor";
export type OnboardingProfile = { onboarding_path: OnboardingPath | null; school_id: string | null };
export type ApprovedSchoolChoice = { id: string; name: string; club_name: string | null; city: string | null };

function client() {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error("Supabase is not configured.");
  return supabase;
}

function fail(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

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

export async function completeAccountOnboarding(input: { path: OnboardingPath; schoolId?: string | null; schoolName?: string; clubName?: string; curriculumSystem?: CurriculumSystem }) {
  const { data, error } = await client().rpc("complete_econmind_onboarding", {
    p_path: input.path,
    p_school_id: input.schoolId ?? null,
    p_school_name: input.schoolName ?? null,
    p_club_name: input.clubName ?? null,
    p_curriculum_system: input.curriculumSystem ?? null,
  });
  fail(error);
  return data as { path: OnboardingPath; school_id?: string; school_name?: string; application_id?: string; status?: string };
}
