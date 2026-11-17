import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { COMMUNICATIONS_TEAM, FOUNDING_TEAM, REGIONAL_LEADERS, REGIONAL_NETWORK, TECHNOLOGY_TEAM } from "@/lib/team/team-data";
import { resolveDirectoryMembers, resolveDirectoryRegions } from "@/lib/team/directory-model";
import type { OrganizationAppointment } from "@/lib/supabase/organization-directory";

/** Parse only the reviewed, fixed-format starter rows; fail closed if it changes. */
function starterRows(): OrganizationAppointment[] {
  const text = readFileSync("supabase/seeds/organization_directory_snapshot_20261115.sql", "utf8");
  const pattern = /^\s*\('((?:''|[^'])*)',\s*'((?:''|[^'])*)',\s*'([^']+)',\s*(null|'(?:''|[^'])*'),\s*'((?:''|[^'])*)',\s*'([^']*)'::jsonb,\s*(\d+),\s*(true|false)\)[,;]?/gim;
  const unquote = (s: string) => s.replaceAll("''", "'");
  return [...text.matchAll(pattern)].map((match, index) => ({
    id: String(index), name: unquote(match[1]), title: unquote(match[2]), organizational_group: match[3],
    region: match[4].toLowerCase() === "null" ? null : unquote(match[4].slice(1, -1)),
    legacy_name: unquote(match[5]), focus: JSON.parse(match[6]) as string[],
    sort_order: Number(match[7]), description: null, portrait_path: null, updated_at: "",
  }));
}

describe("authorized shared organization starter directory", () => {
  it("preserves every current appointment, role, focus, portrait, contact and regional index", () => {
    const rows = starterRows();
    expect(rows).toHaveLength(26);
    const groups = [
      ["founding-team", FOUNDING_TEAM], ["regional-leadership", REGIONAL_LEADERS],
      ["communications-team", COMMUNICATIONS_TEAM], ["technology-team", TECHNOLOGY_TEAM],
    ] as const;
    for (const [group, originals] of groups) {
      const selected = rows.filter(row => row.organizational_group === group);
      expect(selected.map(row => row.legacy_name)).toEqual(originals.map(member => member.name));
      const resolved = resolveDirectoryMembers(selected, group, originals);
      expect(resolved.map(member => ({ name: member.name, role: member.role, focus: member.focus ?? [], image: member.image, contact: member.contact, secondaryContact: member.secondaryContact })))
        .toEqual(originals.map(member => ({ name: member.name, role: member.role, focus: member.focus ?? [], image: member.image, contact: member.contact, secondaryContact: member.secondaryContact })));
    }
    expect(resolveDirectoryRegions(rows, REGIONAL_NETWORK)).toEqual(REGIONAL_NETWORK);
  });
  it("reflects a changed and a newly added region without reviving removed leads", () => {
    const rows = starterRows().filter(row => row.name !== "Emma");
    rows.push({ ...rows[0], id: "new-region", name: "New Lead", organizational_group: "regional-leadership", region: "New Region" });
    const regions = resolveDirectoryRegions(rows, REGIONAL_NETWORK);
    expect(regions.find(row => row.region === "Beijing")?.leads).not.toContain("Emma");
    expect(regions.at(-1)).toEqual({ region: "New Region", leads: ["New Lead"] });
  });
});
