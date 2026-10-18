import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
// @ts-expect-error Standalone reviewed database publisher has no TS declaration.
import { publishCountryPreferences } from "../scripts/publish-season1-country-preferences.mjs";
// @ts-expect-error Standalone read-only release prerequisite.
import { checkCountryBackend } from "../scripts/check-season1-country-backend.mjs";
const migration = readFileSync(
  "supabase/migrations/20261018000000_season1_country_preferences.sql",
  "utf8",
);
const verification = readFileSync(
  "scripts/verify-season1-country-preferences.sql",
  "utf8",
);
describe("scoped country preference database release", () => {
  it("checks the backend without applying any database changes and fails closed", async () => {
    const request = vi.fn().mockResolvedValue([{ verified: true }]);
    expect(await checkCountryBackend(request)).toBe(true);
    expect(request).toHaveBeenCalledExactlyOnceWith(verification);
    request.mockResolvedValue([{ verified: false }]);
    await expect(checkCountryBackend(request)).rejects.toThrow(
      "verification failed",
    );
  });
  it("applies exactly one transaction including preservation, constraints, grants, readback and ledger", async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce([{ installed: false, table_exists: false }])
      .mockResolvedValueOnce([{ ready: true }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ verified: true }]);
    expect(
      await publishCountryPreferences({ request, migration, verification }),
    ).toBe("published");
    expect(request.mock.calls.filter((call) => call[1] === false)).toHaveLength(
      1,
    );
    const sql = request.mock.calls[2][0];
    expect(sql).toContain("country_release_preserved");
    expect(sql).toContain(
      "Existing teams, memberships or roster functions changed",
    );
    expect(sql).toContain("world_preseason_country_one_team_idx");
    expect(sql).toContain("security definer set search_path = '' as $$");
    expect(sql.match(/\$\$/g)?.length).toBe(
      (migration.match(/\$\$/g)?.length ?? 0) * 2,
    );
    expect(sql).toContain("20261018000000");
    expect(sql).toMatch(/commit;\s*$/);
    expect(sql).not.toMatch(/delete from|truncate|world_v2\./i);
    expect(request.mock.calls.at(-1)).toEqual([verification, true]);
  });
  it("never replays an installed migration", async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce([{ installed: true, table_exists: true }])
      .mockResolvedValueOnce([{ verified: true }]);
    expect(
      await publishCountryPreferences({ request, migration, verification }),
    ).toBe("already-installed");
    expect(request.mock.calls.every((call) => call[1] === true)).toBe(true);
  });
  it("does not overwrite an untracked table", async () => {
    const request = vi
      .fn()
      .mockResolvedValue([{ installed: false, table_exists: true }]);
    await expect(
      publishCountryPreferences({ request, migration, verification }),
    ).rejects.toThrow("Untracked");
    expect(request).toHaveBeenCalledTimes(1);
  });
  it("fails closed before writes on missing dependencies", async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce([{ installed: false, table_exists: false }])
      .mockResolvedValueOnce([{ ready: false }]);
    await expect(
      publishCountryPreferences({ request, migration, verification }),
    ).rejects.toThrow("dependencies");
    expect(request.mock.calls.every((call) => call[1] === true)).toBe(true);
  });
  it("never retries a timed-out or failed write", async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce([{ installed: false, table_exists: false }])
      .mockResolvedValueOnce([{ ready: true }])
      .mockRejectedValueOnce(new Error("Timeout"));
    await expect(
      publishCountryPreferences({ request, migration, verification }),
    ).rejects.toThrow("Timeout");
    expect(request.mock.calls.filter((call) => call[1] === false)).toHaveLength(
      1,
    );
  });
  it("rejects false readback without claiming activation", async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce([{ installed: true, table_exists: true }])
      .mockResolvedValueOnce([{ verified: false }]);
    await expect(
      publishCountryPreferences({ request, migration, verification }),
    ).rejects.toThrow("readback");
  });
});
