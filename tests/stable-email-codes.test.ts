import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createStableEmailHook,
  createVerifyCodeHandler,
  seal,
  unseal,
  subjectKey,
  type Claim,
  type CodeStore,
  type Dependencies,
  type Purpose,
} from "../supabase/functions/_shared/stable-email-codes";
import { verifyStableEmailCode } from "../lib/supabase/stable-email-verification";

const secret = btoa("12345678901234567890123456789012");
function fixture() {
  let now = Date.now();
  const records = new Map<
    string,
    Claim & { consumed: boolean; lastSent: number; attempts: number }
  >();
  const store: CodeStore = {
    async send(subject, _purpose, code, hash) {
      const prior = records.get(subject);
      if (prior?.lease) return { status: "busy" };
      if (prior && !prior.consumed && Date.parse(prior.expires_at!) > now) {
        if (prior.lastSent > now - 60_000) return { status: "limited" };
        prior.hash_ciphers!.unshift(hash);
        prior.lastSent = now;
        return { ...prior };
      }
      const next = {
        status: "ready" as const,
        code_cipher: code,
        hash_ciphers: [hash],
        expires_at: new Date(now + 3600_000).toISOString(),
        consumed: false,
        lastSent: now,
        attempts: 0,
      };
      records.set(subject, next);
      return { ...next };
    },
    async claim(subject) {
      const r = records.get(subject);
      if (!r) return { status: "legacy" };
      if (r.consumed || Date.parse(r.expires_at!) <= now)
        return { status: "invalid" };
      if (r.lease) return { status: "busy" };
      if (r.attempts >= 10) return { status: "limited" };
      r.attempts++;
      r.lease = crypto.randomUUID();
      return { ...r };
    },
    async finish(subject, lease, consumed) {
      const r = records.get(subject);
      if (!r || r.lease !== lease) return false;
      r.lease = undefined;
      r.consumed ||= consumed;
      return true;
    },
  };
  const sendMail = vi.fn().mockResolvedValue(undefined);
  const verifyNative = vi.fn().mockResolvedValue({
    access_token: "access-fixture",
    refresh_token: "refresh-fixture",
  });
  const deps: Dependencies = {
    store,
    secret,
    sendMail,
    verifyNative,
    verifyLegacy: vi.fn().mockResolvedValue(null),
    authenticateHook: (body) => JSON.parse(body),
    now: () => now,
  };
  const hook = createStableEmailHook(deps);
  const verify = createVerifyCodeHandler(deps);
  const send = (
    code = "12345678",
    purpose = "signup",
    hash = "a".repeat(64),
    address = "User@example.test",
  ) =>
    hook(
      new Request("https://local.test/hook", {
        method: "POST",
        body: JSON.stringify({
          user: { email: address },
          email_data: {
            email_action_type: purpose,
            token: code,
            token_hash: hash,
            redirect_to: "https://econmind.group/",
            site_url: "https://econmind.group",
          },
        }),
      }),
    );
  const check = (
    code = "12345678",
    purpose: Purpose = "signup",
    address = "user@example.test",
  ) =>
    verify(
      new Request("https://local.test/verify", {
        method: "POST",
        headers: { Origin: "https://econmind.group" },
        body: JSON.stringify({ email: address, token: code, purpose }),
      }),
    );
  return {
    deps,
    records,
    sendMail,
    verifyNative,
    send,
    check,
    advance: (ms: number) => {
      now += ms;
    },
  };
}

describe("fixed 60-minute authentication codes", () => {
  it("resends the first code and verifies against the newest native credential", async () => {
    const f = fixture();
    expect((await f.send()).status).toBe(200);
    const expiry = f.sendMail.mock.calls[0][3];
    f.advance(61_000);
    expect((await f.send("87654321", "signup", "b".repeat(64))).status).toBe(
      200,
    );
    expect(f.sendMail.mock.calls.map((c) => c[1])).toEqual([
      "12345678",
      "12345678",
    ]);
    expect(f.sendMail.mock.calls[1][3]).toBe(expiry);
    expect((await f.check()).status).toBe(200);
    expect(f.verifyNative).toHaveBeenCalledWith(
      "b".repeat(64),
      "signup",
      "unknown",
    );
  });
  it("does not extend the window; exactly 60 minutes requires a new code", async () => {
    const f = fixture();
    await f.send();
    f.advance(3599_000);
    await f.send("87654321");
    expect(f.sendMail.mock.calls[1][1]).toBe("12345678");
    f.advance(1000);
    expect((await f.check()).status).toBe(403);
    await f.send("87654321");
    expect(f.sendMail.mock.calls[2][1]).toBe("87654321");
    expect((await f.check("87654321")).status).toBe(200);
  });
  it("serializes simultaneous resends and verifications across a shared store", async () => {
    const f = fixture();
    const sent = await Promise.all([f.send(), f.send("87654321")]);
    expect(sent.map((r) => r.status).sort()).toEqual([200, 429]);
    expect(f.sendMail).toHaveBeenCalledTimes(1);
    const sentCode = f.sendMail.mock.calls[0][1];
    const verified = await Promise.all([f.check(sentCode), f.check(sentCode)]);
    expect(verified.map((r) => r.status).sort()).toEqual([200, 403]);
    expect(f.verifyNative).toHaveBeenCalledTimes(1);
    expect((await f.check()).status).toBe(403);
  });
  it("separates signup and recovery, and wrong codes cannot reach native verification", async () => {
    const f = fixture();
    await f.send();
    await f.send("22222222", "recovery");
    expect((await f.check("12345678", "recovery")).status).toBe(403);
    expect(f.verifyNative).not.toHaveBeenCalled();
    expect((await f.check("22222222", "recovery")).status).toBe(200);
    expect((await f.check()).status).toBe(200);
  });
  it("does not reset failed-attempt limits on resend", async () => {
    const f = fixture();
    await f.send();
    for (let i = 0; i < 10; i++)
      expect((await f.check("00000000")).status).toBe(403);
    f.advance(61_000);
    await f.send("87654321");
    expect((await f.check()).status).toBe(429);
    expect(f.verifyNative).not.toHaveBeenCalled();
  });
  it("releases the lease without consuming on transient Auth failure", async () => {
    const f = fixture();
    await f.send();
    f.verifyNative.mockRejectedValueOnce(new Error("private provider detail"));
    const response = await f.check();
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("private provider detail");
    expect((await f.check()).status).toBe(200);
  });
  it("tolerates a hook whose native token has not committed yet", async () => {
    const f = fixture();
    await f.send();
    f.verifyNative.mockResolvedValueOnce(null);
    expect((await f.check()).status).toBe(403);
    expect((await f.check()).status).toBe(200);
  });
  it("falls through only for pre-activation codes, never for expired/consumed cached codes", async () => {
    const f = fixture();
    expect(await (await f.check()).json()).toMatchObject({
      code: "otp_expired",
    });
    expect(f.deps.verifyLegacy).toHaveBeenCalledWith(
      "user@example.test",
      "12345678",
      "signup",
      "unknown",
    );
    await f.send();
    f.advance(3600_000);
    expect(await (await f.check()).json()).toMatchObject({
      code: "otp_expired",
    });
    expect(f.deps.verifyLegacy).toHaveBeenCalledTimes(1);
  });
  it("stores only authenticated ciphertext and opaque keyed subjects", async () => {
    const f = fixture();
    await f.send();
    const stored = JSON.stringify([...f.records]);
    expect(stored).not.toContain("12345678");
    expect(stored).not.toContain("user@example.test");
    const cipher = await seal(secret, "12345678", "signup:code");
    expect(await unseal(secret, cipher, "signup:code")).toBe("12345678");
    await expect(unseal(secret, cipher, "recovery:code")).rejects.toThrow();
    expect(await subjectKey(secret, "signup:user@example.test")).not.toBe(
      await subjectKey(secret, "recovery:user@example.test"),
    );
  });
  it("does not expose cache/account existence through an invalid-code response", async () => {
    const f = fixture();
    const absent = await f.check("00000000");
    await f.send();
    const present = await f.check("00000000");
    expect(absent.status).toBe(403);
    expect(present.status).toBe(403);
    expect(await absent.json()).toEqual(await present.json());
  });
  it("requires a valid hook signature before any store/mail access", async () => {
    const f = fixture();
    f.deps.authenticateHook = () => {
      throw new Error("Bad signature");
    };
    expect((await f.send()).status).toBe(401);
    expect(f.records.size).toBe(0);
    expect(f.sendMail).not.toHaveBeenCalled();
  });
  it("provider failure does not rotate the outward code on a later resend", async () => {
    const f = fixture();
    f.sendMail.mockRejectedValueOnce(new Error("Mail failed"));
    expect((await f.send()).status).toBe(503);
    f.advance(61_000);
    expect((await f.send("87654321")).status).toBe(200);
    expect(f.sendMail.mock.calls[1][1]).toBe("12345678");
  });
  it("keeps secure email-change old/new token pairing intact", async () => {
    const f = fixture();
    const response = await createStableEmailHook(f.deps)(
      new Request("https://local.test/hook", {
        method: "POST",
        body: JSON.stringify({
          user: { email: "old@example.test", new_email: "new@example.test" },
          email_data: {
            email_action_type: "email_change",
            token: "11111111",
            token_new: "22222222",
            token_hash_new: "a".repeat(64),
            token_hash: "b".repeat(64),
            redirect_to: "https://econmind.group",
          },
        }),
      }),
    );
    expect(response.status).toBe(200);
    expect(f.sendMail.mock.calls[0][0]).toBe("old@example.test");
    expect(f.sendMail.mock.calls[0][4]).toContain("token=" + "a".repeat(64));
    expect(f.sendMail.mock.calls[1][0]).toBe("new@example.test");
    expect(f.sendMail.mock.calls[1][4]).toContain("token=" + "b".repeat(64));
  });
  it("rejects untrusted origins and oversized bodies", async () => {
    const f = fixture();
    const handler = createVerifyCodeHandler(f.deps);
    expect(
      (
        await handler(
          new Request("https://local.test", {
            method: "POST",
            headers: { Origin: "https://evil.test" },
            body: "{}",
          }),
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await handler(
          new Request("https://local.test", {
            method: "POST",
            body: "x".repeat(32769),
          }),
        )
      ).status,
    ).toBe(400);
    expect(f.verifyNative).not.toHaveBeenCalled();
  });
});

describe("browser bridge", () => {
  function browser(result: unknown, error: unknown = null) {
    const client = {
      functions: { invoke: vi.fn().mockResolvedValue({ data: result, error }) },
      auth: {
        setSession: vi.fn().mockResolvedValue({ error: null }),
        verifyOtp: vi.fn().mockResolvedValue({ error: null }),
      },
    };
    return { client: client as unknown as SupabaseClient, methods: client };
  }
  it("installs only a verified native session", async () => {
    const { client, methods } = browser({
      session: { access_token: "fixture", refresh_token: "fixture" },
    });
    await verifyStableEmailCode(
      client,
      "user@example.test",
      "12345678",
      "recovery",
    );
    expect(methods.auth.setSession).toHaveBeenCalledTimes(1);
    expect(methods.auth.verifyOtp).not.toHaveBeenCalled();
  });
  it("rejects an obsolete client-fallback payload rather than exposing cache existence", async () => {
    const { client, methods } = browser({ native_fallback: true });
    await expect(
      verifyStableEmailCode(client, "user@example.test", "12345678", "signup"),
    ).rejects.toMatchObject({ code: "service_unavailable" });
    expect(methods.auth.verifyOtp).not.toHaveBeenCalled();
  });
  it("never falls back after a rejected cached verification", async () => {
    const { client, methods } = browser(null, {
      context: {
        json: async () => ({ code: "otp_expired", message: "private" }),
      },
    });
    await expect(
      verifyStableEmailCode(client, "user@example.test", "12345678", "signup"),
    ).rejects.toMatchObject({ code: "otp_expired" });
    expect(methods.auth.verifyOtp).not.toHaveBeenCalled();
    expect(methods.auth.setSession).not.toHaveBeenCalled();
  });
  it("preserves native signup, resend, Google and password-update workflows", () => {
    const dialog = readFileSync("components/auth/auth-dialog.tsx", "utf8");
    for (const flow of [
      "auth.signUp",
      "auth.resend",
      "resetPasswordForEmail",
      "signInWithOAuth",
      "auth.updateUser",
      "legal_acceptance",
      "rejectUnexpectedSignupSession",
    ])
      expect(dialog).toContain(flow);
    expect(dialog).not.toContain("auth.verifyOtp");
    expect(dialog).toContain("verifyStableEmailCode");
  });
});
