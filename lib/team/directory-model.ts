import type { DirectoryMember, DirectoryRegion } from "@/lib/admin/leadership-tables";
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

/** Preserve the established regional index ordering while allowing live additions. */
export function resolveDirectoryRegions(
  appointments: readonly OrganizationAppointment[], original: readonly DirectoryRegion[],
): DirectoryRegion[] {
  const groups = new Map<string, string[]>();
  for (const item of appointments) {
    if (item.organizational_group === "regional-leadership" && item.region) {
      const leads = groups.get(item.region) ?? [];
      leads.push(item.name);
      groups.set(item.region, leads);
    }
  }
  const result: DirectoryRegion[] = [];
  for (const previous of original) {
    const leads = groups.get(previous.region);
    if (!leads) continue;
    result.push({ region: previous.region, leads: [...previous.leads.filter(name => leads.includes(name)), ...leads.filter(name => !previous.leads.includes(name))] });
    groups.delete(previous.region);
  }
  for (const [region, leads] of groups) result.push({ region, leads });
  return result;
}
