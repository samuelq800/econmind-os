import type { AcademicProfile } from "@/lib/supabase/competition-matching";

type SchoolLocation = {
  city?: string | null;
  area?: string | null;
};

/** Keep user-entered values when a school's location has not been verified. */
export function prefillAcademicSchoolLocation(
  academic: AcademicProfile,
  school: SchoolLocation | null | undefined,
): AcademicProfile {
  return {
    ...academic,
    country: school?.area?.trim() || academic.country,
    location: school?.city?.trim() || academic.location,
  };
}
