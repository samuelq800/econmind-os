import {
  COMMUNICATIONS_TEAM,
  FOUNDING_TEAM,
  REGIONAL_LEADERS,
  REGIONAL_NETWORK,
  TECHNOLOGY_TEAM,
  type TeamMember,
} from "@/lib/team/team-data";
import type { PageTable } from "./page-tables";

export type DirectoryMember = Omit<TeamMember, "contact"> & { contact?: TeamMember["contact"] };
export type DirectorySection = readonly [string, readonly DirectoryMember[]];
export type DirectoryRegion = { region: string; leads: readonly string[] };

/** Same authoritative directory arrays as /team, one row per appointment, not per person. */
export function leadershipTables(input?: { sections: readonly DirectorySection[]; network: readonly DirectoryRegion[] }): PageTable[] {
  const sections: readonly DirectorySection[] = input?.sections ?? [
    ["Founding Team", FOUNDING_TEAM],
    ["Regional Leadership", REGIONAL_LEADERS],
    ["Communications Department", COMMUNICATIONS_TEAM],
    ["Technology Department", TECHNOLOGY_TEAM],
  ];
  const network = input?.network ?? REGIONAL_NETWORK;
  const columns = [
    { key: "department", label: "Department" },
    { key: "name", label: "Name" },
    { key: "role", label: "Role" },
    { key: "regions", label: "Regions" },
    { key: "focus", label: "Focus" },
    { key: "contactType", label: "Contact type" },
    { key: "contact", label: "Contact" },
    { key: "secondaryType", label: "Secondary contact type" },
    { key: "secondaryContact", label: "Secondary contact" },
    { key: "portrait", label: "Portrait asset" },
  ];
  const rows = sections.flatMap(([department, members]) =>
    members.map((member) => ({
      department,
      name: member.name,
      role: member.role,
      regions: network.filter((node) =>
        (node.leads as readonly string[]).includes(member.name),
      )
        .map((node) => node.region)
        .join("; "),
      focus: member.focus?.join("; "),
      contactType: member.contact?.type,
      contact: member.contact?.value,
      secondaryType: member.secondaryContact?.type,
      secondaryContact: member.secondaryContact?.value,
      portrait: member.image,
    })),
  );
  const table = (
    id: string,
    title: string,
    selected: typeof rows,
  ): PageTable => ({
    id,
    title,
    columns,
    rows: selected,
    filename: `econmind-leadership-${id}.csv`,
    description:
      "One row per appointment. A person serving in multiple departments appears once in each department. Contacts match the public directory.",
  });
  return [
    table("all", "All appointments", rows),
    ...sections.map(([department], index) =>
      table(
        `department-${index + 1}`,
        department,
        rows.filter((row) => row.department === department),
      ),
    ),
    {
      id: "regions",
      title: "Regional index",
      filename: "econmind-regional-index.csv",
      description: "Complete regional index from the same source as the page.",
      columns: [
        { key: "region", label: "Region" },
        { key: "leads", label: "Leads" },
      ],
      rows: network.map((node) => ({
        region: node.region,
        leads: node.leads.join("; "),
      })),
    },
  ];
}
