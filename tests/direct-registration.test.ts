import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createDirectRegistrationHandler } from "../supabase/functions/_shared/direct-registration";
import { ACKNOWLEDGEMENT_DOCUMENTS } from "@/lib/legal/acknowledgement";
import { directAccountAddress } from "@/lib/supabase/account-identifier";
import { signInWithAccountIdentifier } from "@/lib/supabase/account-sign-in";
import { registerDirect } from "@/lib/supabase/direct-registration";
const policies = Object.fromEntries(
  ACKNOWLEDGEMENT_DOCUMENTS.map(({ key }) => [key, true]),
);
const acceptance = {
  terms: true,
  privacy: true,
  termsVersion: "2.0",
  privacyVersion: "2.0",
  policies,
};
function fixture() {
  const deps = {
    authorize: vi.fn().mockResolvedValue("new"),
    createAccount: vi.fn().mockResolvedValue(undefined),
  };
  const handler = createDirectRegistrationHandler(deps);
  const send = (patch = {}, origin = "https://econmind.group") =>
    handler(
      new Request("https://example.test", {
        method: "POST",
        headers: { Origin: origin, "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier: "小明",
          displayName: "Member",
          password: "password-for-tests",
          legalAcceptance: acceptance,
          ...patch,
        }),
      }),
    );
  return { deps, handler, send };
}
describe("isolated direct registration", () => {
  it("accepts a non-email ID, ignores privilege injection and does not expose tokens", async () => {
    const { deps, send } = fixture();
    const response = await send({
      platform_role: "platform_admin",
      email_confirm: false,
      user_id: "someone-else",
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    const [address, , metadata, audit] = deps.createAccount.mock.calls[0];
    expect(address).toBe(await directAccountAddress("小明"));
    expect(metadata).toMatchObject({
      registration_id: "小明",
      policy_acknowledgement: { release_id: "2026-10-21-v2", checks: policies },
    });
    expect(metadata).not.toHaveProperty("platform_role");
    expect(audit.direct_registration).toEqual({
      method: "direct_link",
      email_ownership_verified: false,
      email_recovery_available: false,
    });
  });
  it("keeps a real address usable by existing verified-email recovery", async () => {
    const { deps, send } = fixture();
    expect((await send({ identifier: "Member@Example.com" })).status).toBe(200);
    expect(deps.createAccount.mock.calls[0][0]).toBe("member@example.com");
    expect(
      deps.createAccount.mock.calls[0][3].direct_registration
        .email_recovery_available,
    ).toBe(true);
  });
  it.each(["invalid", "limited", "unavailable"])(
    "never creates or mutates an account when authorization is %s",
    async (status) => {
      const { deps, send } = fixture();
      deps.authorize.mockResolvedValue(status);
      expect((await send()).status).toBe(
        status === "limited" ? 429 : status === "unavailable" ? 503 : 400,
      );
      expect(deps.createAccount).not.toHaveBeenCalled();
    },
  );
  it.each([
    {
      legalAcceptance: {
        ...acceptance,
        policies: { ...policies, "world/terms": false },
      },
    },
    {
      legalAcceptance: {
        ...acceptance,
        policies: { terms: true, privacy: true },
      },
    },
    { legalAcceptance: { ...acceptance, termsVersion: "1.2" } },
    { identifier: "  " },
    { identifier: "name\nadmin" },
    { password: "short" },
    { displayName: "" },
  ])(
    "requires all explicit current policies and valid bounded input: %o",
    async (patch) => {
      const { deps, send } = fixture();
      expect((await send(patch)).status).toBe(400);
      expect(deps.authorize).not.toHaveBeenCalled();
      expect(deps.createAccount).not.toHaveBeenCalled();
    },
  );
  it("rejects third-party origins, unsupported methods and oversized streaming bodies", async () => {
    const { deps, send, handler } = fixture();
    expect((await send({}, "https://untrusted.test")).status).toBe(403);
    expect(
      (await handler(new Request("https://example.test", { method: "GET" })))
        .status,
    ).toBe(405);
    expect(
      (
        await handler(
          new Request("https://example.test", { method: "OPTIONS" }),
        )
      ).status,
    ).toBe(204);
    expect((await send({ extra: "x".repeat(9000) })).status).toBe(400);
    expect(deps.createAccount).not.toHaveBeenCalled();
  });
  it("uses one consistent case-insensitive namespace for direct IDs and existing email logins", async () => {
    expect(await directAccountAddress(" Ａlice ")).toBe(
      await directAccountAddress("alice"),
    );
    const auth = {
      signInWithPassword: vi.fn().mockResolvedValue({ error: null }),
    };
    const client = { auth } as unknown as SupabaseClient;
    await signInWithAccountIdentifier(client, "小明", "password");
    expect(auth.signInWithPassword).toHaveBeenLastCalledWith({
      email: await directAccountAddress("小明"),
      password: "password",
    });
    await signInWithAccountIdentifier(client, "Test@Example.com", "password");
    expect(auth.signInWithPassword).toHaveBeenLastCalledWith({
      email: "test@example.com",
      password: "password",
    });
  });
  it("does not sign in on failed creation and never sends admin settings", async () => {
    const invoke = vi
      .fn()
      .mockResolvedValue({ data: { ok: true }, error: null });
    const signInWithPassword = vi.fn().mockResolvedValue({ error: null });
    const client = {
      functions: { invoke },
      auth: { signInWithPassword },
    } as unknown as SupabaseClient;
    const input = {
      identifier: "中文账号",
      password: "test-password",
      displayName: "Member",
      legalAcceptance: acceptance,
    };
    await registerDirect(client, input);
    expect(invoke).toHaveBeenCalledWith("register-direct", { body: input });
    expect(signInWithPassword).toHaveBeenCalledWith({
      email: await directAccountAddress(input.identifier),
      password: input.password,
    });
    signInWithPassword.mockClear();
    invoke.mockResolvedValue({ data: null, error: new Error("duplicate") });
    await expect(registerDirect(client, input)).rejects.toThrow(
      "already exists",
    );
    expect(signInWithPassword).not.toHaveBeenCalled();
  });
});
