import { readFileSync } from "node:fs";
import { createElement } from "react";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, describe, expect, it, vi } from "vitest";
import { AdminPageDataTables } from "@/components/admin/page-data-tables";
import { leadershipTables } from "@/lib/admin/leadership-tables";
import { season1Tables } from "@/lib/admin/season1-tables";
import {
  cellText,
  filterTableRows,
  tableCsv,
  type PageTable,
} from "@/lib/admin/page-tables";
import {
  COMMUNICATIONS_TEAM,
  FOUNDING_TEAM,
  REGIONAL_LEADERS,
  TECHNOLOGY_TEAM,
} from "@/lib/team/team-data";
import type { Season1AdminOverview } from "@/lib/supabase/season1-admin";

const auth = vi.hoisted(() => ({
  value: {
    user: null as null | { id: string },
    worldSupervisor: false,
    loading: false,
    roleLoading: false,
  },
}));
vi.mock("@/components/auth/auth-provider", () => ({
  useAuth: () => auth.value,
}));
// The default Vitest TSX transform is classic; production uses Next's JSX runtime.
vi.stubGlobal("React", React);
afterAll(() => vi.unstubAllGlobals());

describe("complete admin page tables", () => {
  it("renders controls only for an authenticated, resolved platform administrator", () => {
    const html = () =>
      renderToStaticMarkup(
        createElement(AdminPageDataTables, {
          title: "Directory",
          tables: leadershipTables(),
        }),
      );
    for (const state of [
      {
        user: null,
        worldSupervisor: false,
        loading: false,
        roleLoading: false,
      },
      {
        user: { id: "member" },
        worldSupervisor: false,
        loading: false,
        roleLoading: false,
      },
      {
        user: { id: "admin" },
        worldSupervisor: true,
        loading: true,
        roleLoading: false,
      },
      {
        user: { id: "admin" },
        worldSupervisor: true,
        loading: false,
        roleLoading: true,
      },
    ]) {
      auth.value = state;
      expect(html()).toBe("");
    }
    auth.value = {
      user: { id: "admin" },
      worldSupervisor: true,
      loading: false,
      roleLoading: false,
    };
    expect(html()).toContain("View complete tables");
    expect(html()).not.toContain("Download full CSV"); // closed by default
  });

  it("uses every directory appointment and all public contact fields without deduplicating roles", () => {
    const tables = leadershipTables();
    const all = tables[0];
    expect(all.rows).toHaveLength(
      FOUNDING_TEAM.length +
        REGIONAL_LEADERS.length +
        COMMUNICATIONS_TEAM.length +
        TECHNOLOGY_TEAM.length,
    );
    expect(tables).toHaveLength(6);
    expect(all.rows.filter((row) => row.name === "Samuel")).toHaveLength(2);
    const vader = all.rows.find((row) => row.name === "Vader");
    expect(vader?.regions).toBe("Jiangsu");
    expect(vader?.secondaryContact).toBe(
      REGIONAL_LEADERS.find((m) => m.name === "Vader")?.secondaryContact?.value,
    );
    expect(
      all.rows
        .filter((row) => row.name === "Sophia Cai")
        .map((row) => row.department),
    ).toEqual(["Regional Leadership"]);
  });

  it("flattens all teams and >1,000 members, including the last row and the same server timestamp", () => {
    const view: Season1AdminOverview = {
      seasonId: "season",
      snapshotAt: "2026-10-14T01:00:00Z",
      countrySnapshotAt: "2026-10-14T01:00:01Z",
      stats: {
        registeredPlayers: 1200,
        participants: 1003,
        teamMembers: 1002,
        teams: 167,
        freeAgents: 1,
        readyMembers: 501,
        lockedTeams: 167,
        teamsOverThree: 167,
        selectedCountryTeams: 20,
      },
      teams: Array.from({ length: 167 }, (_, i) => ({
        id: `team-${i}`,
        name: `Team ${i}`,
        code: `CODE-${i}`,
        capacity: 6,
        status: "full",
        recruiting: false,
        recruitmentLocked: true,
        recruitmentMode: "open",
        teamStyle: "balanced",
        preferredLanguage: "English",
        schoolName: null,
        description: "A team",
        focus: "Research",
        createdAt: "2026-10-13T01:00:00Z",
        memberCount: 6,
        readyCount: 3,
        applicationCount: 0,
        members: Array.from({ length: 6 }, (_, j) => ({
          userId: `user-${i}-${j}`,
          displayName: `Member ${i}-${j}`,
          schoolName: j === 5 ? "学校" : null,
          memberRole: j === 0 ? "captain" : "member",
          rolePreferences: ["Finance & Economy"],
          isReady: j < 3,
          joinedAt: "2026-10-13T02:00:00Z",
        })),
      })),
    };
    const [teams, members, summary] = season1Tables(view);
    expect(teams.rows).toHaveLength(167);
    expect(members.rows).toHaveLength(1002);
    expect(summary.rows).toHaveLength(9);
    expect(
      summary.rows.find((row) => row.metric === "Locked teams")?.value,
    ).toBe(167);
    expect(
      summary.rows.find((row) => row.metric === "Teams with 4+ members")?.value,
    ).toBe(167);
    expect(
      summary.rows.find((row) => row.metric === "Teams with a country"),
    ).toMatchObject({ value: 20, countrySnapshotAt: view.countrySnapshotAt });
    expect(members.rows.at(-1)?.userId).toBe("user-166-5");
    expect(teams.rows[0].captainUserId).toBe("user-0-0");
    expect(teams.rows[0].memberSchools).toBe("学校");
    expect(
      members.rows.every((row) => row.snapshotAt === view.snapshotAt),
    ).toBe(true);
    const before = tableCsv(members);
    expect(filterTableRows(members, "Member 166-5")).toHaveLength(1);
    expect(tableCsv(members)).toBe(before);
    expect(before).toContain('"user-166-5"');
    expect(filterTableRows(members, "no matches")).toHaveLength(0);
    expect(tableCsv({ ...members, rows: [] }).split("\r\n")).toHaveLength(2);
    const source = readFileSync("lib/admin/season1-tables.ts", "utf8");
    expect(source).not.toMatch(/\.slice\(|\.limit\(|\.from\(/);
  });

  it("preserves CSV commas, quotes, multiline Chinese, false, zero and null", () => {
    const table: PageTable = {
      id: "test",
      title: "Test",
      description: "",
      filename: "test.csv",
      columns: [
        { key: "a", label: "名称" },
        { key: "b", label: "Value" },
      ],
      rows: [
        { a: '中文,"quoted"\nnext', b: false },
        { a: 0, b: null },
      ],
    };
    expect(tableCsv(table)).toBe(
      '\uFEFF"名称","Value"\r\n"中文,""quoted""\nnext","No"\r\n"0",""\r\n',
    );
    expect(cellText(undefined)).toBe("");
    expect(cellText(true)).toBe("Yes");
  });

  it.each([
    "=SUM(A1)",
    "+86 18913955666",
    "-1+2",
    "@SUM(A1)",
    "  =1",
    "\t=1",
    "\r\n=1",
    "\ttext",
  ])("neutralizes spreadsheet formula/control prefixes: %s", (value) => {
    const table: PageTable = {
      id: "test",
      title: "Test",
      description: "",
      filename: "test.csv",
      columns: [{ key: "a", label: "Value" }],
      rows: [{ a: value }],
    };
    expect(tableCsv(table)).toContain(`"'${value}"`);
  });

  it("shares the authorized overview, disables stale exports and does not add database reads or subscriptions", () => {
    const panel = readFileSync(
      "components/season1/season1-admin-overview.tsx",
      "utf8",
    );
    const tables = readFileSync(
      "components/admin/page-data-tables.tsx",
      "utf8",
    );
    expect(panel).toContain("tables={season1Tables(view)}");
    expect(panel).toContain("stale={Boolean(error)}");
    expect(tables).toContain("disabled={stale || !table.rows.length}");
    expect(tables).toContain("downloadTableCsv(table)");
    expect(tables).not.toMatch(/getSupabase|\.rpc\(|\.channel\(|setInterval/);
    expect(readFileSync("components/team/team-page.tsx", "utf8")).toContain(
      "<LeadershipDataTables />",
    );
  });
});
