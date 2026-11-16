import type { DirectoryMember } from "@/lib/admin/leadership-tables";
import type { OrganizationAppointment } from "@/lib/supabase/organization-directory";

/** Only a reviewed legacy link may transfer old presentation/contact details. */
export function resolveDirectoryMembers(
  appointments: readonly OrganizationAppointment[], group: string, fallback: readonly DirectoryMember[],
): DirectoryMember[] {
  return appointments.filter(item => item.organizational_group === group).map(item => {
    const matches = item.legacy_name ? fallback.filter(member => member.name === item.legacy_name) : [];
    const previous = matches.length === 1 ? matches[0] : undefined;
    return { ...previous, name: item.name, role: item.title, focus: item.focus,
      image: item.portrait_path ?? previous?.image } as DirectoryMember;
  });
}
