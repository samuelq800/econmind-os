import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
  publishReusableTeamNames,
  MIGRATION,
  VERSION,
} from "../scripts/publish-season1-reusable-team-names.mjs";

const migration = readFileSync(MIGRATION, "utf8");
const verification = readFileSync(
  "scripts/verify-season1-reusable-team-names.sql",
  "utf8",
);

describe("scoped team-name publication", () => {
  it("commits only this migration, verification and history in one request", async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce([{ installed: false }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ verified: true }]);
    expect(
      await publishReusableTeamNames({ request, migration, verification }),
    ).toBe("published");
    const [query, readOnly] = request.mock.calls[1];
    expect(readOnly).toBe(false);
    expect(query).toContain("begin;");
    expect(query).toContain("do $release$");
    expect(query).toContain(
      `values ('${VERSION}','season1_reusable_team_names'`,
    );
    expect(query.trim()).toMatch(/commit;$/);
    expect(request.mock.calls[2]).toEqual([verification, true]);
  });
  it("does not replay an installed release and rejects drift", async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce([{ installed: true }])
      .mockResolvedValueOnce([{ verified: false }]);
    await expect(
      publishReusableTeamNames({ request, migration, verification }),
    ).rejects.toThrow("readback failed");
    expect(request).toHaveBeenCalledTimes(2);
    expect(request.mock.calls.every((call) => call[1] === true)).toBe(true);
  });
  it("never retries a write with an unknown result", async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce([{ installed: false }])
      .mockRejectedValueOnce(new Error("unknown write result"));
    await expect(
      publishReusableTeamNames({ request, migration, verification }),
    ).rejects.toThrow("unknown write result");
    expect(request).toHaveBeenCalledTimes(2);
  });
  it("fails closed on invalid installation metadata and missing transaction", async () => {
    const request = vi.fn().mockResolvedValue([{ installed: "false" }]);
    await expect(
      publishReusableTeamNames({ request, migration, verification }),
    ).rejects.toThrow("Invalid installation metadata");
    expect(request).toHaveBeenCalledTimes(1);
    request.mockClear();
    await expect(
      publishReusableTeamNames({
        request,
        migration: "select 1;",
        verification,
      }),
    ).rejects.toThrow("Explicit migration transaction");
    expect(request).not.toHaveBeenCalled();
  });
});
