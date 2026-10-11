import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  COMMUNICATIONS_TEAM,
  REGIONAL_NETWORK,
  REGIONAL_LEADERS,
  TECHNOLOGY_TEAM,
} from "@/lib/team/team-data";
import {
  getSeason1AdminOverview,
  subscribeToSeason1AdminOverview,
} from "@/lib/supabase/season1-admin";
// @ts-expect-error Scoped standalone publisher has no TypeScript declaration.
import { publishAdminOverview } from "../scripts/publish-season1-admin-overview.mjs";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  getSession: vi.fn(),
  channel: vi.fn(),
}));
vi.mock("@/lib/supabase/client", () => ({
  requireSupabaseBrowserClient: () => ({
    rpc: mocks.rpc,
    auth: { getSession: mocks.getSession },
    channel: mocks.channel,
  }),
  throwIfSupabaseError: (error: unknown) => {
    if (error) throw error;
  },
}));
beforeEach(() => {
  vi.clearAllMocks();
});

describe("department directory", () => {
  it("removes only Sophia Cai's technology and communications entries", () => {
    expect(TECHNOLOGY_TEAM.some((m) => m.name === "Sophia Cai")).toBe(false);
    expect(COMMUNICATIONS_TEAM.some((m) => m.name === "Sophia Cai")).toBe(
      false,
    );
    expect(REGIONAL_LEADERS.some((m) => m.name === "Sophia Cai")).toBe(true);
    expect(
      REGIONAL_NETWORK.find((region) => region.region === "Zhejiang")?.leads,
    ).toContain("Sophia Cai");
    expect(REGIONAL_LEADERS.some((m) => m.name === "Sophia Liu")).toBe(true);
  });
});

describe("Season 1 admin overview", () => {
  it("uses the guarded read-only RPC rather than loading rosters from public tables", async () => {
    const data = {
      seasonId: "season",
      snapshotAt: new Date().toISOString(),
      stats: {},
      teams: [],
    };
    mocks.rpc.mockResolvedValue({ data, error: null });
    expect(await getSeason1AdminOverview()).toEqual(data);
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith(
      "get_world_preseason_admin_overview",
    );
    mocks.rpc.mockResolvedValue({
      data: null,
      error: new Error("Permission denied"),
    });
    await expect(getSeason1AdminOverview()).rejects.toThrow(
      "Permission denied",
    );
    mocks.rpc.mockResolvedValue({ data: null, error: null });
    await expect(getSeason1AdminOverview()).rejects.toThrow("unavailable");
  });

  it("does not create a channel after asynchronous session loading is disposed", async () => {
    let resolve!: (value: unknown) => void;
    mocks.getSession.mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    let disposed = false;
    const pending = subscribeToSeason1AdminOverview(
      "season",
      vi.fn(),
      vi.fn(),
      () => disposed,
    );
    disposed = true;
    resolve({ data: { session: { user: { id: "admin" } } }, error: null });
    expect(await pending).toBe(null);
    expect(mocks.channel).not.toHaveBeenCalled();
  });

  it("invalidates on team and roster changes including primary-key-only deletes", async () => {
    mocks.getSession.mockResolvedValue({ data: { session: {} }, error: null });
    const channel = { on: vi.fn(), subscribe: vi.fn() };
    mocks.channel.mockReturnValue(channel);
    const change = vi.fn(),
      status = vi.fn();
    expect(
      await subscribeToSeason1AdminOverview(
        "season",
        change,
        status,
        () => false,
      ),
    ).toBe(channel);
    expect(channel.on).toHaveBeenCalledTimes(12);
    expect(channel.on).toHaveBeenCalledWith(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "world_preseason_teams",
        filter: "season_id=eq.season",
      },
      change,
    );
    expect(channel.on).toHaveBeenCalledWith(
      "postgres_changes",
      {
        event: "DELETE",
        schema: "public",
        table: "world_preseason_team_members",
      },
      change,
    );
    expect(channel.subscribe).toHaveBeenCalledExactlyOnceWith(status);
  });

  it("gates the panel on admin authority and shares the stable single-flight lifecycle", () => {
    const lobby = readFileSync(
      "components/season1/season1-team-lobby.tsx",
      "utf8",
    );
    const panel = readFileSync(
      "components/season1/season1-admin-overview.tsx",
      "utf8",
    );
    expect(lobby).toContain("worldSupervisor && <Season1AdminOverviewPanel");
    expect(lobby).toContain('href="#admin-overview"');
    expect(panel).toContain("useRoomRefresh(`${seasonId}:${userId}`");
    expect(panel).not.toContain("setInterval");
    for (const label of [
      "Platform accounts",
      "Season 1 participants",
      "View team details",
      "Team members",
      "Role preferences:",
      'role="dialog"',
      'aria-modal="true"',
      'event.key === "Escape"',
      'event.key !== "Tab"',
    ])
      expect(panel).toContain(label);
  });

  it("keeps the new database change read-only, scoped and admin-authorized", () => {
    const sql = readFileSync(
      "supabase/migrations/20261011000000_season1_admin_overview.sql",
      "utf8",
    );
    expect(sql).toContain("perform public.world_preseason_require_admin()");
    expect(sql).toContain("stable security definer set search_path = ''");
    expect(sql).toContain("from public, anon, authenticated");
    expect(sql).toContain("status <> 'dissolved'");
    for (const word of [
      "delete from",
      "update public",
      "insert into",
      "alter policy",
      "grant select",
      "email",
      "chat_messages",
    ])
      expect(sql.toLowerCase()).not.toContain(word);
  });

  it("publishes exactly one transactional migration without retrying uncertain writes", async () => {
    const migration = "begin;\nselect 1;\ncommit;\n",
      verification = "select 2;";
    const request = vi
      .fn()
      .mockResolvedValueOnce([{ installed: false }])
      .mockResolvedValueOnce([]);
    expect(
      await publishAdminOverview({ request, migration, verification }),
    ).toBe("published");
    expect(request).toHaveBeenCalledTimes(2);
    expect(request.mock.calls[1][0]).toContain("select 2;");
    expect(request.mock.calls[1][0]).toContain("20261011000000");
    expect(request.mock.calls[1][0]).toMatch(/commit;$/);
    request
      .mockReset()
      .mockResolvedValueOnce([{ installed: true }])
      .mockResolvedValueOnce([]);
    expect(
      await publishAdminOverview({ request, migration, verification }),
    ).toBe("already-installed");
    expect(request).toHaveBeenLastCalledWith(verification, false);
    request
      .mockReset()
      .mockResolvedValueOnce([{ installed: false }])
      .mockRejectedValueOnce(new Error("unknown write result"));
    await expect(
      publishAdminOverview({ request, migration, verification }),
    ).rejects.toThrow("unknown write result");
    expect(request).toHaveBeenCalledTimes(2);
  });
});
