import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { pageAccessForPath } from "../lib/platform/access-control";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/lib/supabase/client", () => ({
  requireSupabaseBrowserClient: () => ({ rpc }),
  getSupabaseBrowserClient: () => null,
  throwIfSupabaseError: (error: { message: string } | null) => { if (error) throw new Error(error.message); },
}));
import { applyToSeason1TeamByCode, getSeason1MyTeam, getSeason1TeamWorkspace, leaveSeason1Team, removeSeason1TeamMember } from "../lib/supabase/season1";

describe("Season 1 My Team", () => {
  beforeEach(() => { rpc.mockReset(); rpc.mockResolvedValue({ data: null, error: null }); });

  it("reads only the signed-in member's team without a caller-supplied user ID", async () => {
    const data = { team: null, membership: null, members: [] };
    rpc.mockResolvedValue({ data, error: null });
    expect(await getSeason1MyTeam()).toEqual(data);
    expect(rpc).toHaveBeenCalledWith("get_world_preseason_my_team", {});
  });
  it("delegates removal and self-exit to separate authorization-checked RPCs", async () => {
    await removeSeason1TeamMember("team-a", "member-b");
    expect(rpc).toHaveBeenLastCalledWith("world_preseason_remove_member", { p_team_id: "team-a", p_user_id: "member-b" });
    await leaveSeason1Team("team-a");
    expect(rpc).toHaveBeenLastCalledWith("world_preseason_leave_team", { p_team_id: "team-a" });
  });
  it("normalizes shareable team codes and propagates server rejection", async () => {
    await applyToSeason1TeamByCode(" em-t1-abc123 ");
    expect(rpc).toHaveBeenLastCalledWith("world_preseason_apply_by_team_code", { p_code: "EM-T1-ABC123" });
    rpc.mockResolvedValue({ data: null, error: { message: "This team roster is locked" } });
    await expect(leaveSeason1Team("team-a")).rejects.toThrow("roster is locked");
  });
  it("provides registered-member navigation, confirmations and stale-roster refresh", () => {
    expect(pageAccessForPath("/season1/my-team/")).toEqual({ path: "/season1", match: "prefix", audience: "account" });
    const page = readFileSync("components/season1/season1-my-team.tsx", "utf8");
    for (const text of ["Team code", "Team members", "Copy code", "Leave team", "window.confirm", "subscribeToSeason1Lobby", "10_000", "setData(null)", "getSeason1TeamWorkspace"])
      expect(page).toContain(text);
    expect(readFileSync("components/layout/navbar.tsx", "utf8")).toContain('href="/season1/my-team"');
    expect(readFileSync("components/season1/season1-team-lobby.tsx", "utf8")).toContain('href="/season1/my-team"');
  });
  it("moves chat and applications to the independent page using the exact Lobby visuals", () => {
    const page = readFileSync("components/season1/season1-my-team.tsx", "utf8");
    const lobby = readFileSync("components/season1/season1-team-lobby.tsx", "utf8");
    expect(readFileSync("app/season1/my-team/page.tsx", "utf8")).toContain('../season1-game-lobby.css');
    for (const text of ["<Season1WorldArtwork />", "season1-lobby", "season1-room-card", "season1-portals", 'id="team-chat"', 'id="team-applications"', "postSeason1TeamMessage", "reviewSeason1Application", "Decline", "loadedFor === user.id"]) expect(page).toContain(text);
    expect(page).not.toContain('href="/season1/#team-room"');
    expect(lobby).toContain("Open My Team");
    expect(lobby).not.toContain('title="Team Chat"');
    expect(lobby).not.toContain("Application activity");
  });
  it("keeps workspace chat and applications scoped to the current team", async () => {
    rpc.mockImplementation(async (name: string) => ({ data: name === "get_world_preseason_my_team" ? { team: { id: "own" }, membership: {}, members: [] } : name === "get_world_preseason_my_pending_team_ids" ? [] : { membership: { teamId: "own" }, season: { config: { roles: [] } }, teamMessages: [{ id: "message" }], applications: [{ id: "yes", teamId: "own" }, { id: "no", teamId: "other" }] }, error: null }));
    const data = await getSeason1TeamWorkspace();
    expect(data.messages).toEqual([{ id: "message" }]);
    expect(data.applications.map(a => a.id)).toEqual(["yes"]);
  });
  it("discards mismatched read snapshots after a membership change", async () => {
    rpc.mockImplementation(async (name: string) => ({ data: name === "get_world_preseason_my_team" ? { team: { id: "old" } } : name === "get_world_preseason_my_pending_team_ids" ? [] : { membership: { teamId: "new" }, applications: [] }, error: null }));
    await expect(getSeason1TeamWorkspace()).rejects.toThrow("membership changed");
  });
  it("shows no private messages or recruitment queue without a team", async () => {
    rpc.mockImplementation(async (name: string) => ({ data: name === "get_world_preseason_my_team" ? { team: null, membership: null, members: [] } : name === "get_world_preseason_my_pending_team_ids" ? [] : { membership: null, season: { config: { roles: [] } }, teamMessages: [{ id: "stale" }], applications: [{ id: "other" }] }, error: null }));
    const data = await getSeason1TeamWorkspace();
    expect(data.messages).toEqual([]);
    expect(data.applications).toEqual([]);
  });
  it("ships a fail-closed migration and requires it before Pages release", () => {
    const sql = readFileSync("supabase/migrations/20260926000000_season1_my_team.sql", "utf8");
    for (const text of ["having count(*) > 6", "set capacity = 6", "'{maximumTeamSize}', '6'", "world_preseason_require_participant()", "for update of t", "The captain cannot be removed", "member_role = 'member'", "from public, anon, authenticated", "world_preseason_refresh_team(p_team_id)"])
      expect(sql).toContain(text);
    expect(readFileSync(".github/workflows/deploy-pages.yml", "utf8")).toContain("scripts/verify-season1-my-team.sql");
    expect(readFileSync(".github/workflows/ci.yml", "utf8")).toContain("scripts/test-season1-my-team.sql");
  });
});
