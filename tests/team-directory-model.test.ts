import { describe, expect, it } from "vitest";
import { resolveDirectoryMembers } from "@/lib/team/directory-model";
import type { OrganizationAppointment } from "@/lib/supabase/organization-directory";
import type { DirectoryMember } from "@/lib/admin/leadership-tables";

const row: OrganizationAppointment = { id: "1", name: "New name", title: "Lead", organizational_group: "technology-team", region: null, legacy_name: null, description: null, focus: [], portrait_path: null, sort_order: 0, updated_at: "now" };
const old = { name: "Former name", role: "Old role", image: "/images/team/example.jpg" } as DirectoryMember;

describe("shared Team directory", () => {
  it("only inherits an old appointment when explicitly linked", () => {
    expect(resolveDirectoryMembers([row], "technology-team", [old])[0].image).toBeUndefined();
    expect(resolveDirectoryMembers([{ ...row, legacy_name: old.name }], "technology-team", [old])[0]).toMatchObject({ name: "New name", role: "Lead", image: old.image });
  });
  it("does not inherit an ambiguous legacy match or another organizational group", () => {
    expect(resolveDirectoryMembers([{ ...row, legacy_name: old.name }], "technology-team", [old, old])[0].image).toBeUndefined();
    expect(resolveDirectoryMembers([row], "communications-team", [old])).toEqual([]);
  });
});
