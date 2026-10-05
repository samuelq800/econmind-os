import { describe, expect, it, vi } from "vitest";
import { publishSeason1TeamLifecycle } from "../scripts/publish-season1-team-lifecycle.mjs";

const migration = "-- reviewed migration\nbegin;\nselect 1;\ncommit;\n";
const verification = "do $verify$ begin null; end $verify$;";

describe("Season 1 lifecycle publication", () => {
  it("verifies an installed release without replaying its migration", async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce([{ installed: true }])
      .mockResolvedValueOnce([]);
    expect(
      await publishSeason1TeamLifecycle({ request, migration, verification }),
    ).toBe("already-installed");
    expect(request).toHaveBeenCalledTimes(2);
    expect(request).toHaveBeenLastCalledWith(verification, false);
    expect(request.mock.calls[0][1]).toBe(true);
  });
  it("verifies first publication before committing and never automatically retries writes", async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce([{ installed: false }])
      .mockRejectedValueOnce(new Error("write result unknown"));
    await expect(
      publishSeason1TeamLifecycle({ request, migration, verification }),
    ).rejects.toThrow("write result unknown");
    expect(request).toHaveBeenCalledTimes(2);
    expect(request.mock.calls[1]).toEqual([
      migration.replace(/commit;\s*$/, `${verification}\ncommit;`),
      false,
    ]);
  });
  it("stops on malformed installation metadata or absent transaction boundaries", async () => {
    const request = vi.fn().mockResolvedValue([{ installed: "false" }]);
    await expect(
      publishSeason1TeamLifecycle({ request, migration, verification }),
    ).rejects.toThrow("invalid result");
    expect(request).toHaveBeenCalledTimes(1);
    request.mockClear();
    await expect(
      publishSeason1TeamLifecycle({
        request,
        migration: "select 1;",
        verification,
      }),
    ).rejects.toThrow("explicit transaction");
    expect(request).not.toHaveBeenCalled();
  });
  it("fails closed when the installed schema fails verification", async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce([{ installed: true }])
      .mockRejectedValueOnce(new Error("permissions invalid"));
    await expect(
      publishSeason1TeamLifecycle({ request, migration, verification }),
    ).rejects.toThrow("permissions invalid");
    expect(request).toHaveBeenCalledTimes(2);
    expect(request).toHaveBeenLastCalledWith(verification, false);
  });
});
