import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { policyAcknowledgementApi } from "@/lib/supabase/policy-acknowledgement";
import {
  ACKNOWLEDGEMENT_DOCUMENTS,
  POLICY_ACKNOWLEDGEMENT_RELEASE,
  PolicyConfirmationCoordinator,
} from "@/lib/legal/acknowledgement";
import {
  rememberOAuthRegistrationConsent,
  pendingOAuthRegistrationConsent,
} from "@/lib/legal/registration-consent";
const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/lib/supabase/client", () => ({
  getSupabaseBrowserClient: () => ({ rpc: mocks.rpc }),
}));
const receipt = (complete: boolean) => ({
  user_id: "new-user",
  release_id: POLICY_ACKNOWLEDGEMENT_RELEASE,
  complete,
});
const policies = Object.fromEntries(
  ACKNOWLEDGEMENT_DOCUMENTS.map(({ key }) => [key, true]),
);
beforeEach(() => {
  vi.clearAllMocks();
  const values = new Map<string, string>();
  vi.stubGlobal("window", {});
  vi.stubGlobal("sessionStorage", {
    getItem: (k: string) => values.get(k) ?? null,
    setItem: (k: string, v: string) => {
      values.set(k, v);
    },
    removeItem: (k: string) => {
      values.delete(k);
    },
  });
});
afterEach(() => vi.unstubAllGlobals());
describe("new-account policy loading without repeat confirmation", () => {
  it("accepts the server's registration receipt without showing a required state", async () => {
    mocks.rpc.mockResolvedValue({ data: receipt(true), error: null });
    const coordinator = new PolicyConfirmationCoordinator(
      policyAcknowledgementApi,
    );
    const seen: string[] = [];
    coordinator.subscribe(() => seen.push(coordinator.getSnapshot().status));
    coordinator.setUser("new-user");
    await vi.waitFor(() =>
      expect(coordinator.getSnapshot().status).toBe("accepted"),
    );
    expect(seen).not.toContain("required");
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });
  it("saves the explicitly checked OAuth draft before returning status, then consumes it", async () => {
    rememberOAuthRegistrationConsent({ terms: true, privacy: true, policies });
    mocks.rpc
      .mockResolvedValueOnce({ data: receipt(false), error: null })
      .mockResolvedValueOnce({ data: receipt(true), error: null });
    expect(await policyAcknowledgementApi.load("new-user")).toEqual(
      receipt(true),
    );
    expect(mocks.rpc).toHaveBeenLastCalledWith("acknowledge_policy_release", {
      p_expected_user_id: "new-user",
      p_release_id: POLICY_ACKNOWLEDGEMENT_RELEASE,
      p_acknowledgements: policies,
    });
    expect(pendingOAuthRegistrationConsent()).toBeNull();
  });
  it("does not auto-confirm old users, and does not lose the OAuth draft on save failure", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: receipt(false), error: null });
    expect(await policyAcknowledgementApi.load("new-user")).toEqual(
      receipt(false),
    );
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    rememberOAuthRegistrationConsent({ terms: true, privacy: true, policies });
    mocks.rpc
      .mockResolvedValueOnce({ data: receipt(false), error: null })
      .mockResolvedValueOnce({ data: null, error: { message: "offline" } });
    await expect(policyAcknowledgementApi.load("new-user")).rejects.toThrow(
      "offline",
    );
    expect(pendingOAuthRegistrationConsent()).toEqual(policies);
  });
});
