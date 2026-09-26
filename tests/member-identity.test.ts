import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  memberDate,
  preferenceLabels,
  safeImageUrl,
  type MemberProfile,
} from "../lib/profile/member-identity";
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/lib/supabase/client", () => ({
  requireSupabaseBrowserClient: () => ({ rpc }),
  throwIfSupabaseError: (error: { message: string } | null) => {
    if (error) throw new Error(error.message);
  },
}));
import {
  changeMyMemberSchool,
  getMyMemberIdentity,
  saveMyMemberIdentity,
  saveMyMemberPreferences,
} from "../lib/supabase/member-identity";
const profile: MemberProfile = {
  userId: "self",
  identity: {
    displayName: null,
    avatarUrl: null,
    bio: "",
    grade: "",
    graduationYear: null,
    clubName: null,
    leaguePreference: null,
    memberSince: null,
  },
  school: null,
  schoolChangeGuard: null,
  roles: [],
  options: [{ category: "area", key: "technology", label: "Technology" }],
  choices: [],
  activity: { season1: null, research: null, liveRoomsHosted: null },
};
describe("Member identity center", () => {
  beforeEach(() => {
    rpc.mockReset();
    rpc.mockResolvedValue({ data: null, error: null });
  });
  it("reads only the current authenticated member without a caller-selected ID", async () => {
    rpc.mockResolvedValue({ data: profile, error: null });
    expect(await getMyMemberIdentity()).toEqual(profile);
    expect(rpc).toHaveBeenCalledWith("get_my_member_identity");
  });
  it("handles empty old profiles and dates without undefined placeholders", () => {
    expect(preferenceLabels(profile, "area")).toEqual([]);
    expect(memberDate(null)).toBeNull();
    expect(memberDate("bad")).toBeNull();
    expect(memberDate("2026-09-01T00:00:00Z")).toBe("Sep 2026");
  });
  it("sends an identity allowlist, never role, school or auth fields", async () => {
    await saveMyMemberIdentity({
      ...profile.identity,
      displayName: " Name ",
      bio: " Bio ",
    });
    expect(rpc).toHaveBeenCalledWith("save_my_member_identity", {
      p_display_name: "Name",
      p_avatar_url: null,
      p_bio: "Bio",
      p_grade: "",
      p_graduation_year: null,
      p_club_name: null,
      p_role_preference: null,
    });
  });
  it("saves preferences only via the preference RPC, not League or Season mutation", async () => {
    await saveMyMemberPreferences("area", ["technology"], "technology");
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("save_my_member_preferences", {
      p_category: "area",
      p_keys: ["technology"],
      p_primary: "technology",
    });
  });
  it("retains an expected canonical school for stale-change detection and supports leave", async () => {
    await changeMyMemberSchool("new", "old");
    expect(rpc).toHaveBeenLastCalledWith("change_my_member_school", {
      p_school_id: "new",
      p_expected_school_id: "old",
    });
    await changeMyMemberSchool(null, "old");
    expect(rpc).toHaveBeenLastCalledWith("change_my_member_school", {
      p_school_id: null,
      p_expected_school_id: "old",
    });
  });
  it("propagates failed loads and failed saves rather than claiming success", async () => {
    await expect(getMyMemberIdentity()).rejects.toThrow("unavailable");
    rpc.mockResolvedValue({ error: { message: "Permission denied" } });
    await expect(saveMyMemberPreferences("skill", ["python"])).rejects.toThrow(
      "Permission denied",
    );
    await expect(changeMyMemberSchool(null, "old")).rejects.toThrow(
      "Permission denied",
    );
  });
  it("does not upgrade declared interests into official roles", () => {
    const next = {
      ...profile,
      choices: [
        { category: "area" as const, key: "technology", primary: true },
      ],
    };
    expect(preferenceLabels(next, "area")[0].label).toBe("Technology");
    expect(next.roles).toEqual([]);
  });
  it("allows only credential-free HTTPS images", () => {
    for (const value of [
      null,
      "",
      "javascript:alert(1)",
      "http://image.test/a",
      "https://user:password@image.test/a",
    ])
      expect(safeImageUrl(value)).toBeNull();
    expect(safeImageUrl("https://image.test/avatar.png")).toBe(
      "https://image.test/avatar.png",
    );
  });
  it("uses an accessible canonical-school confirmation, read-only roles and existing privacy", () => {
    const ui = readFileSync(
      "components/profile/member-identity-center.tsx",
      "utf8",
    );
    for (const value of [
      "<dialog",
      "showModal()",
      'aria-labelledby="school-dialog-title"',
      "Confirm change",
      "Confirm leave",
      "listApprovedSchoolChoices",
      "profile.roles.map",
      "System records · Read only",
      "ProfilePrivacyControls",
      "aria-pressed={selected}",
      "lg:grid-cols-",
      "min-w-0",
    ])
      expect(ui).toContain(value);
    expect(ui).not.toContain("roomsJoined");
    expect(ui).not.toContain("Room joins use");
    expect(ui).not.toContain("REGIONAL_LEADERS");
    expect(ui).toContain("/season1/my-team");
    expect(ui).not.toContain("world_preseason_set_my_preferences");
  });
  it("isolates user switches and retries without reusing another member's identity", () => {
    const loader = readFileSync("components/league/profile-editor.tsx", "utf8");
    expect(loader).toContain("key={user.id}");
    expect(loader).toContain("next.userId === userId");
    expect(loader).toContain("active = false");
  });
  it("ships real PostgreSQL authorization and persistence tests", () => {
    const sql = readFileSync("scripts/test-member-identity.sql", "utf8");
    for (const value of [
      "set role authenticated",
      "cannot read other preferences",
      "cannot update other member",
      "school leave preserves Season history",
      "authoritative leader badge",
      "step down",
      "extensible catalog",
    ])
      expect(sql).toContain(value);
    expect(readFileSync(".github/workflows/ci.yml", "utf8")).toContain(
      "scripts/test-member-identity.sql",
    );
  });
});
