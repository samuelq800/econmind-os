import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
  approvePending,
  approvalSql,
  inspectBatch,
  pendingQuery,
} from "../scripts/approve-season1-pending.mjs";
const id = "10000000-0000-0000-0000-000000000001";
const template = readFileSync("scripts/approve-season1-pending.sql", "utf8");
describe("one-time Season 1 pending approval", () => {
  it("previews without writes or logging applicant details", async () => {
    const request = vi.fn().mockResolvedValue([{ id }]);
    const result = await approvePending({ request, mode: "preview", template });
    expect(request).toHaveBeenCalledExactlyOnceWith(pendingQuery, true);
    expect(result.pending).toBe(1);
    expect(result.fingerprint).toHaveLength(64);
    expect(JSON.stringify(result)).not.toContain(id);
  });
  it("approves only the inspected UUIDs and never retries uncertain writes", async () => {
    const fingerprint = inspectBatch([{ id }]).fingerprint;
    const request = vi
      .fn()
      .mockResolvedValueOnce([{ id }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          result: {
            inspected: 1,
            accepted: 1,
            acceptedWithoutMembership: 0,
            pendingInBatch: 0,
          },
        },
      ]);
    await approvePending({
      request,
      mode: "approve",
      expectedFingerprint: fingerprint,
      template,
    });
    expect(request.mock.calls[1]).toEqual([approvalSql(template, [id]), false]);
    request
      .mockReset()
      .mockResolvedValueOnce([{ id }])
      .mockRejectedValueOnce(new Error("Unknown write outcome"));
    await expect(
      approvePending({
        request,
        mode: "approve",
        expectedFingerprint: fingerprint,
        template,
      }),
    ).rejects.toThrow("Unknown write outcome");
    expect(request).toHaveBeenCalledTimes(2);
  });
  it("fails closed on changed batches, duplicate IDs or injected input", async () => {
    const request = vi.fn().mockResolvedValue([{ id }]);
    await expect(
      approvePending({
        request,
        mode: "approve",
        expectedFingerprint: "0".repeat(64),
        template,
      }),
    ).rejects.toThrow("snapshot changed");
    expect(request).toHaveBeenCalledTimes(1);
    expect(() => inspectBatch([{ id }, { id }])).toThrow("Duplicate");
    expect(() =>
      approvalSql(template, ["'); drop table public.profiles;--"]),
    ).toThrow("Invalid");
  });
  it("does not claim success or repeat the write if accepted records lack membership", async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce([{ id }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          result: {
            inspected: 1,
            accepted: 1,
            pendingInBatch: 0,
            acceptedWithoutMembership: 1,
          },
        },
      ]);
    await expect(
      approvePending({
        request,
        mode: "approve",
        expectedFingerprint: inspectBatch([{ id }]).fingerprint,
        template,
      }),
    ).rejects.toThrow("post-commit verification failed");
    expect(request).toHaveBeenCalledTimes(3);
    expect(request.mock.calls.filter((call) => call[1] === false)).toHaveLength(
      1,
    );
  });
  it("keeps membership guards, roster locks, capacity, other seasons, and user attribution intact", () => {
    expect(template).toContain("s.code='season-1'");
    expect(template).toContain("v_team.recruitment_locked");
    expect(template).toContain("v_team.capacity");
    expect(template).toContain("already_in_other_team");
    expect(template).toContain("reviewed_by=null");
    expect(template).toContain("Inspected application batch changed");
    expect(template).not.toMatch(
      /disable trigger|alter policy|set_config|auth\.users|update public\.profiles|delete from public\.world_preseason_team_members/i,
    );
  });
});
