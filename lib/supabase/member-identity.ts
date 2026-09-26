import {
  requireSupabaseBrowserClient as client,
  throwIfSupabaseError as fail,
} from "./client";
import type {
  MemberIdentity,
  MemberProfile,
  PreferenceCategory,
} from "@/lib/profile/member-identity";
export async function getMyMemberIdentity(): Promise<MemberProfile> {
  const { data, error } = await client().rpc("get_my_member_identity");
  fail(error);
  if (
    !data?.userId ||
    !data?.identity ||
    !Array.isArray(data.options) ||
    !Array.isArray(data.choices)
  )
    throw new Error("Member profile is unavailable. Please retry.");
  return data as MemberProfile;
}
export async function saveMyMemberIdentity(identity: MemberIdentity) {
  const { error } = await client().rpc("save_my_member_identity", {
    p_display_name: identity.displayName?.trim() || null,
    p_avatar_url: identity.avatarUrl?.trim() || null,
    p_bio: identity.bio.trim(),
    p_grade: identity.grade.trim(),
    p_graduation_year: identity.graduationYear,
    p_club_name: identity.clubName?.trim() || null,
    p_role_preference: identity.leaguePreference,
  });
  fail(error);
}
export async function saveMyMemberPreferences(
  category: PreferenceCategory,
  keys: string[],
  primary: string | null = null,
) {
  const { error } = await client().rpc("save_my_member_preferences", {
    p_category: category,
    p_keys: keys,
    p_primary: primary,
  });
  fail(error);
}
export async function changeMyMemberSchool(
  schoolId: string | null,
  expectedSchoolId: string | null,
) {
  const { error } = await client().rpc("change_my_member_school", {
    p_school_id: schoolId,
    p_expected_school_id: expectedSchoolId,
  });
  fail(error);
}
