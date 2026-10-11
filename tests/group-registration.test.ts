import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createGroupRegistrationHandler,
  provePendingRegistrationPassword,
  type GroupAccount,
  type GroupRegistrationDependencies,
} from "../supabase/functions/_shared/group-registration";
import { registerWithGroupCode } from "../lib/supabase/group-registration";
import { LEGAL_DOCUMENTS } from "../lib/legal/legal-config";

function fixture() {
  const account: GroupAccount = {
    id: "pending-user",
    email: "member@example.test",
    identities: [{ provider: "email" }],
    app_metadata: { provider: "email" },
  };
  const deps: GroupRegistrationDependencies = {
    authorize: vi.fn().mockResolvedValue({ status: "new" }),
    peerKey: vi.fn().mockResolvedValue("a".repeat(64)),
    createAccount: vi.fn().mockResolvedValue(undefined),
    getAccount: vi.fn().mockResolvedValue(account),
    provePendingPassword: vi.fn().mockResolvedValue(true),
    activateAccount: vi.fn().mockResolvedValue(undefined),
    now: () => Date.parse("2026-10-11T12:00:00Z"),
  };
  const input = {
    email: "member@example.test",
    password: "original-password",
    code: "GROUP-TEST-2026",
    displayName: "Member",
    legalAcceptance: {
      terms: true,
      privacy: true,
      termsVersion: LEGAL_DOCUMENTS.terms.version,
      privacyVersion: LEGAL_DOCUMENTS.privacy.version,
    },
  };
  const handler = createGroupRegistrationHandler(deps);
  const send = (patch: Record<string, unknown> = {}) =>
    handler(
      new Request("https://local.test/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "https://econmind.group",
          "x-forwarded-for": "127.0.0.1",
        },
        body: JSON.stringify({ ...input, ...patch }),
      }),
    );
  return { account, deps, input, handler, send };
}

describe("shared group registration", () => {
  it("uses the same global limit bucket despite different forwarded IPs", async () => {
    const { handler, input, deps } = fixture();
    for (const ip of ["192.0.2.1", "198.51.100.2"]) {
      await handler(
        new Request("https://local.test/register", {
          method: "POST",
          headers: {
            Origin: "https://econmind.group",
            "x-forwarded-for": ip,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(input),
        }),
      );
    }
    expect(deps.peerKey).toHaveBeenNthCalledWith(
      1,
      "global-group-registration",
    );
    expect(deps.peerKey).toHaveBeenNthCalledWith(
      2,
      "global-group-registration",
    );
  });
  it("accepts only native password proof and closes a transient session after a concurrent confirmation", async () => {
    const close = vi.fn().mockResolvedValue(undefined);
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error_code: "email_not_confirmed" }), {
        status: 400,
      }),
    );
    expect(
      await provePendingRegistrationPassword(
        "https://auth.local.test",
        "public-key",
        "member@example.test",
        "original-password",
        close,
        fetcher,
      ),
    ).toBe(true);
    expect(fetcher).toHaveBeenCalledWith(
      "https://auth.local.test/auth/v1/token?grant_type=password",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          email: "member@example.test",
          password: "original-password",
        }),
      }),
    );
    for (const [status, body] of [
      [400, { error_code: "invalid_credentials" }],
      [429, { error_code: "email_not_confirmed" }],
      [500, {}],
      [200, { access_token: "transient-session" }],
    ] as const) {
      fetcher.mockResolvedValue(new Response(JSON.stringify(body), { status }));
      expect(
        await provePendingRegistrationPassword(
          "https://auth.local.test",
          "public-key",
          "member@example.test",
          "original-password",
          close,
          fetcher,
        ),
      ).toBe(false);
    }
    expect(close).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledWith("transient-session");
  });
  it("reuses the same code for multiple people and returns no credentials", async () => {
    const { deps, send } = fixture();
    const first = await send({
      email: " First@Example.test ",
      role: "teacher",
      app_metadata: { platform_role: "platform_admin" },
    });
    const second = await send({ email: "second@example.test" });
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(await first.json()).toEqual({ ok: true });
    expect(first.headers.get("cache-control")).toBe("no-store");
    expect(deps.authorize).toHaveBeenNthCalledWith(
      1,
      "GROUP-TEST-2026",
      "first@example.test",
      "a".repeat(64),
    );
    expect(deps.createAccount).toHaveBeenCalledTimes(2);
    expect(deps.createAccount).toHaveBeenNthCalledWith(
      1,
      "first@example.test",
      "original-password",
      {
        display_name: "Member",
        legal_acceptance: {
          terms_version: LEGAL_DOCUMENTS.terms.version,
          privacy_version: LEGAL_DOCUMENTS.privacy.version,
        },
      },
      {
        group_registration: {
          method: "shared_group_code",
          email_ownership_verified: false,
          activated_at: "2026-10-11T12:00:00.000Z",
        },
      },
    );
  });

  it.each(["invalid", "limited", "unavailable"])(
    "rejects %s authorization before accessing Auth",
    async (status) => {
      const { deps, send } = fixture();
      vi.mocked(deps.authorize).mockResolvedValue({
        status: status as "invalid" | "limited" | "unavailable",
      });
      const response = await send();
      expect(response.status).toBe(
        status === "limited" ? 429 : status === "unavailable" ? 503 : 400,
      );
      expect(deps.createAccount).not.toHaveBeenCalled();
      expect(deps.provePendingPassword).not.toHaveBeenCalled();
      expect(deps.activateAccount).not.toHaveBeenCalled();
    },
  );

  it("requires the existing pending account's password before confirming it", async () => {
    const { deps, send } = fixture();
    vi.mocked(deps.authorize).mockResolvedValue({
      status: "pending",
      user_id: "pending-user",
    });
    expect((await send()).status).toBe(200);
    expect(deps.provePendingPassword).toHaveBeenCalledWith(
      "member@example.test",
      "original-password",
    );
    expect(deps.activateAccount).toHaveBeenCalledWith(
      "pending-user",
      expect.objectContaining({
        provider: "email",
        group_registration: expect.objectContaining({
          email_ownership_verified: false,
        }),
      }),
    );
    expect(deps.createAccount).not.toHaveBeenCalled();
    vi.mocked(deps.provePendingPassword).mockResolvedValue(false);
    vi.mocked(deps.activateAccount).mockClear();
    expect((await send({ password: "wrong-password" })).status).toBe(400);
    expect(deps.activateAccount).not.toHaveBeenCalled();
  });

  it.each([
    { email_confirmed_at: "2026-10-01T00:00:00Z" },
    { email: "different@example.test" },
    { id: "different-user" },
    { banned_until: "2026-10-12T00:00:00Z" },
    { is_anonymous: true },
    { identities: [{ provider: "google" }] },
    { identities: [] },
  ])(
    "rechecks pending account restrictions after password proof: %j",
    async (patch) => {
      const { deps, account, send } = fixture();
      vi.mocked(deps.authorize).mockResolvedValue({
        status: "pending",
        user_id: "pending-user",
      });
      vi.mocked(deps.getAccount).mockResolvedValue({ ...account, ...patch });
      expect((await send()).status).toBe(400);
      expect(deps.activateAccount).not.toHaveBeenCalled();
    },
  );

  it.each([
    { legalAcceptance: { terms: true, privacy: false } },
    {
      legalAcceptance: {
        terms: true,
        privacy: true,
        termsVersion: "0.0",
        privacyVersion: "0.0",
      },
    },
    { password: "short" },
    { password: "p".repeat(1025) },
    { email: "not-an-email" },
    { code: "c".repeat(129) },
    { displayName: "n".repeat(81) },
  ])("validates consent and bounded registration data: %j", async (patch) => {
    const { deps, send } = fixture();
    expect((await send(patch)).status).toBe(400);
    expect(deps.authorize).not.toHaveBeenCalled();
  });

  it("fails closed on native creation/activation errors without exposing details", async () => {
    const { deps, send } = fixture();
    vi.mocked(deps.createAccount).mockRejectedValue(
      new Error("email exists; sensitive service key"),
    );
    const response = await send();
    expect(response.status).toBe(400);
    expect(await response.text()).not.toMatch(/sensitive|email exists/);
    expect(deps.activateAccount).not.toHaveBeenCalled();
  });

  it("accepts allowed preflight, rejects unexpected origin and malformed/oversized requests", async () => {
    const { handler, deps } = fixture();
    expect(
      (
        await handler(
          new Request("https://local.test", {
            method: "OPTIONS",
            headers: { Origin: "http://localhost:3000" },
          }),
        )
      ).status,
    ).toBe(204);
    expect(
      (
        await handler(
          new Request("https://local.test", {
            method: "POST",
            headers: { Origin: "https://other.test" },
          }),
        )
      ).status,
    ).toBe(403);
    expect((await handler(new Request("https://local.test"))).status).toBe(405);
    for (const body of ["{", "null", "[]", "x".repeat(4097)]) {
      expect(
        (
          await handler(
            new Request("https://local.test", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body,
            }),
          )
        ).status,
      ).toBe(400);
    }
    expect(deps.authorize).not.toHaveBeenCalled();
  });
});

describe("group registration browser bridge and existing access boundaries", () => {
  function browser() {
    const invoke = vi
      .fn()
      .mockResolvedValue({ data: { ok: true }, error: null });
    const signIn = vi.fn().mockResolvedValue({ error: null });
    const rpc = vi.fn().mockResolvedValue({ error: null });
    const client = {
      functions: { invoke },
      auth: { signInWithPassword: signIn },
      rpc,
    } as unknown as SupabaseClient;
    const input = {
      email: "member@example.test",
      password: "original-password",
      code: "GROUP-TEST-2026",
      displayName: "Member",
      legalAcceptance: { terms: true, privacy: true },
    };
    return { invoke, signIn, rpc, client, input };
  }
  it("signs in natively only after acceptance and records current consent", async () => {
    const { invoke, signIn, rpc, client, input } = browser();
    await registerWithGroupCode(client, input);
    expect(invoke).toHaveBeenCalledWith("register-with-group-code", {
      body: {
        ...input,
        legalAcceptance: {
          ...input.legalAcceptance,
          termsVersion: LEGAL_DOCUMENTS.terms.version,
          privacyVersion: LEGAL_DOCUMENTS.privacy.version,
        },
      },
    });
    expect(signIn).toHaveBeenCalledWith({
      email: input.email,
      password: input.password,
    });
    expect(rpc).toHaveBeenCalledWith("accept_current_legal_documents", {
      p_terms_version: LEGAL_DOCUMENTS.terms.version,
      p_privacy_version: LEGAL_DOCUMENTS.privacy.version,
    });
  });
  it("never signs in after rejection and sanitizes backend errors", async () => {
    const { invoke, signIn, client, input } = browser();
    invoke.mockResolvedValue({
      data: null,
      error: {
        context: {
          json: async () => ({
            code: "over_request_rate_limit",
            message: "sensitive",
          }),
        },
      },
    });
    await expect(registerWithGroupCode(client, input)).rejects.toThrow(
      "wait ten minutes",
    );
    expect(signIn).not.toHaveBeenCalled();
  });
  it("lets an accepted registration recover from a failed subsequent sign-in", async () => {
    const { signIn, rpc, client, input } = browser();
    signIn.mockResolvedValue({ error: { message: "opaque failure" } });
    await expect(registerWithGroupCode(client, input)).rejects.toThrow(
      "registration was accepted",
    );
    expect(rpc).not.toHaveBeenCalled();
  });
  it("keeps group, viewing and recovery flows distinct and stores no production code in browser source", () => {
    const dialog = readFileSync("components/auth/auth-dialog.tsx", "utf8");
    const config = readFileSync("supabase/config.toml", "utf8");
    expect(dialog).toMatch(
      /openAuth\(\s*authMode === "group-sign-up" \? "sign-up" : "group-sign-up",?\s*\)/,
    );
    expect(dialog).toContain("Shared group registration code");
    expect(dialog).toContain("startViewerSession(invitationCode)");
    expect(dialog).toMatch(
      /verifyStableEmailCode\(\s*supabase,\s*verificationEmail,\s*otp.trim\(\),\s*"signup",?\s*\)/,
    );
    expect(dialog).toContain("resetPasswordForEmail");
    expect(dialog).toContain('provider: "google"');
    expect(dialog).not.toContain(inputProductionCode());
    expect(config).toContain("enable_confirmations = true");
  });
});

function inputProductionCode() {
  return ["ECONMIND", "2026", "7"].join("-");
}
