import { createHash } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  season1Countries,
  countryByCode,
  normalizeCountryCode,
} from "@/lib/season1/countries";
import catalog from "@/lib/season1/country-catalog.json";
import map from "@/lib/season1/world-map.json";
import { pageAccessForPath } from "@/lib/platform/access-control";
import {
  getCountryPreferences,
  saveCountryPreference,
  subscribeCountryPreferences,
} from "@/lib/supabase/season1-countries";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  session: vi.fn(),
  channel: vi.fn(),
}));
vi.mock("@/lib/supabase/client", () => ({
  requireSupabaseBrowserClient: () => ({
    rpc: mocks.rpc,
    auth: { getSession: mocks.session },
    channel: mocks.channel,
  }),
  throwIfSupabaseError: (error: unknown) => {
    if (error) throw error;
  },
}));
beforeEach(() => vi.clearAllMocks());
const source = (path: string) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

describe("Season 1 country catalog", () => {
  it("includes the repository world terrain and all matching numbered boundaries", () => {
    expect(map.commit).toBe(catalog.commit);
    expect(map.countries).toEqual(
      season1Countries.map((country) => country.code),
    );
    const svg = source(`public${map.image}`);
    expect(createHash("sha256").update(svg).digest("hex")).toBe(
      map.imageSha256,
    );
    expect(svg).toContain('href="data:image/webp;base64,');
    expect(svg.match(/data-country="/g)).toHaveLength(70);
    expect(svg).not.toMatch(/<script|onload=|https?:\/\/(?!www.w3.org)/);
  });
  it("maps all 70 distinct countries to pinned native-resolution scenes and verified thumbnails", () => {
    expect(catalog.commit).toBe("1a40309601074fe37fa3526f66a0b5c0beedb308");
    expect(season1Countries.map((c) => c.code)).toEqual(
      Array.from({ length: 70 }, (_, i) => String(i + 1).padStart(2, "0")),
    );
    for (const country of season1Countries) {
      expect(country.width).toBeGreaterThanOrEqual(1024);
      expect(country.height).toBeGreaterThanOrEqual(1024);
      for (const [path, hash] of [
        [country.image, country.imageSha256],
        [country.thumbnail, country.thumbnailSha256],
      ]) {
        const bytes = readFileSync(
          new URL(`../public${path}`, import.meta.url),
        );
        expect(bytes.subarray(0, 4).toString()).toBe("RIFF");
        expect(createHash("sha256").update(bytes).digest("hex")).toBe(hash);
      }
    }
    expect(countryByCode("52")?.name).toBe("Zorin");
  });
  it("normalizes only supported country codes", () => {
    expect(normalizeCountryCode("1")).toBe("01");
    expect(normalizeCountryCode(" 52 ")).toBe("52");
    for (const code of ["0", "71", "001", "1e1", "-1", "", "aa"])
      expect(normalizeCountryCode(code)).toBeNull();
  });
});

describe("country preference RPC and subscriptions", () => {
  it("uses guarded RPCs with explicit team and expected selection", async () => {
    const data = { seasonId: "season", countries: [], myTeam: null };
    mocks.rpc.mockResolvedValue({ data, error: null });
    expect(await getCountryPreferences()).toEqual(data);
    mocks.rpc.mockResolvedValue({
      data: { ...data, myTeam: { id: "team", preference: { code: "52" } } },
      error: null,
    });
    expect(
      (await saveCountryPreference("team", "52", "01")).myTeam?.preference
        ?.code,
    ).toBe("52");
    expect(mocks.rpc).toHaveBeenLastCalledWith(
      "set_world_preseason_country_preference",
      {
        p_team_id: "team",
        p_country_code: "52",
        p_expected_country_code: "01",
      },
    );
    mocks.rpc.mockResolvedValue({
      data: null,
      error: new Error("Already reserved"),
    });
    await expect(saveCountryPreference("team", "52", null)).rejects.toThrow(
      "Already reserved",
    );
  });
  it("does not claim a successful save when the server snapshot does not confirm the team and country", async () => {
    mocks.rpc.mockResolvedValue({
      data: { seasonId: "season", countries: [], myTeam: null },
      error: null,
    });
    await expect(saveCountryPreference("team", "52", null)).rejects.toThrow(
      "server did not confirm",
    );
  });
  it("does not establish a channel when asynchronous session loading finishes after cleanup", async () => {
    let resolve!: (value: unknown) => void;
    let disposed = false;
    mocks.session.mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const pending = subscribeCountryPreferences(
      "season",
      vi.fn(),
      vi.fn(),
      () => disposed,
    );
    disposed = true;
    resolve({ data: { session: {} }, error: null });
    expect(await pending).toBeNull();
    expect(mocks.channel).not.toHaveBeenCalled();
  });
  it("invalidates via existing team events without subscribing to private preference records", async () => {
    mocks.session.mockResolvedValue({ data: { session: {} }, error: null });
    const channel = { on: vi.fn(), subscribe: vi.fn() };
    mocks.channel.mockReturnValue(channel);
    const change = vi.fn(),
      status = vi.fn();
    await subscribeCountryPreferences("season", change, status, () => false);
    expect(channel.on).toHaveBeenCalledTimes(6);
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
    expect(
      channel.on.mock.calls.some(
        (call) => call[1].table === "world_preseason_country_preferences",
      ),
    ).toBe(false);
  });
  it("keeps the real integration under authenticated lobby and preview behind a development-only gate", () => {
    expect(source("components/season1/season1-country-page.tsx")).toContain(
      "<Season1CountryHero",
    );
    expect(source("components/season1/season1-country-hero.tsx")).toContain(
      "<Season1WorldArtwork",
    );
    expect(source("components/season1/season1-team-lobby.tsx")).not.toContain(
      "<Season1CountryPreferences",
    );
    expect(source("components/season1/season1-team-lobby.tsx")).toContain(
      'href="/season1/countries"',
    );
    expect(source("components/season1/season1-country-page.tsx")).toContain(
      "<Season1CountryPreferences",
    );
    expect(source("app/season1/countries/preview/page.tsx")).toContain(
      'process.env.NODE_ENV !== "development"',
    );
    expect(
      source("components/season1/season1-country-preferences.tsx"),
    ).toContain("useRoomRefresh(`season-1:countries:${userId}`");
    expect(source("components/season1/season1-my-team.tsx")).toContain(
      '<Season1WorkspaceNav active="team"',
    );
    expect(pageAccessForPath("/season1/countries").audience).toBe("account");
    expect(pageAccessForPath("/season1/countries/preview").audience).toBe(
      "account",
    );
    expect(
      existsSync(
        new URL(
          "../app/live-auction/country-preview/page.tsx",
          import.meta.url,
        ),
      ),
    ).toBe(false);
    const shell = source("components/layout/application-shell.tsx");
    expect(shell).toContain(
      'process.env.NODE_ENV === "development" && pathname.replace(/\\/+$/, "") === "/season1/countries/preview"',
    );
  });
});
