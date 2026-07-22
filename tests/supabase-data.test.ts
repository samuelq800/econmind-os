import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getClient: vi.fn() }));

vi.mock("@/lib/supabase/client", () => ({
  getSupabaseBrowserClient: mocks.getClient,
}));

import { listLearningProgress } from "@/lib/supabase/data";

describe("Supabase data failures", () => {
  beforeEach(() => mocks.getClient.mockReset());

  it("reports a missing public client instead of crashing silently", async () => {
    mocks.getClient.mockReturnValue(null);
    await expect(listLearningProgress("user-id")).rejects.toThrow("Supabase is not configured");
  });

  it("surfaces a failed Supabase request", async () => {
    mocks.getClient.mockReturnValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            order: async () => ({ data: null, error: { message: "network unavailable" } }),
          }),
        }),
      }),
    });
    await expect(listLearningProgress("user-id")).rejects.toThrow("network unavailable");
  });
});
