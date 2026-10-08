import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
// @ts-expect-error Standalone deployment script has no TypeScript declaration.
import * as deployment from "../scripts/deploy-stable-email-codes.mjs";

describe("scoped authentication deployment", () => {
  it("patches only expiry, hook and native per-client-IP rate attribution", () => {
    const patch = deployment.activationPatch("test-hook-secret");
    expect(Object.keys(patch).sort()).toEqual([
      "hook_send_email_enabled",
      "hook_send_email_secrets",
      "hook_send_email_uri",
      "mailer_otp_exp",
      "security_sb_forwarded_for_enabled",
    ]);
    expect(patch.mailer_otp_exp).toBe(3600);
    expect(patch.hook_send_email_uri).toBe(
      "https://vimksjrhaxdpnkvgsavz.supabase.co/functions/v1/stable-auth-email",
    );
  });
  it("refuses to replace an active hook or bypass required email confirmation", () => {
    expect(() =>
      deployment.assertPreflight({ hook_send_email_enabled: true }),
    ).toThrow("already enabled");
    expect(() =>
      deployment.assertPreflight({
        mailer_autoconfirm: true,
        mailer_otp_length: 8,
        mailer_otp_exp: 1200,
      }),
    ).toThrow("confirmation");
    expect(() =>
      deployment.assertPreflight({
        mailer_autoconfirm: false,
        mailer_otp_length: 6,
        mailer_otp_exp: 1200,
      }),
    ).toThrow("eight-digit");
    expect(() =>
      deployment.assertPreflight({
        mailer_autoconfirm: false,
        mailer_otp_length: 8,
        mailer_otp_exp: 1200,
      }),
    ).not.toThrow();
  });
  it("independently fingerprints every unrelated OAuth/SMTP setting", () => {
    const before = {
      smtp_pass: "fixture-secret",
      external_google_enabled: true,
      mailer_otp_exp: 1200,
    };
    expect(deployment.unrelatedFingerprint(before)).toBe(
      deployment.unrelatedFingerprint({
        ...before,
        ...deployment.activationPatch("fixture"),
      }),
    );
    expect(deployment.unrelatedFingerprint(before)).not.toBe(
      deployment.unrelatedFingerprint({
        ...before,
        external_google_enabled: false,
      }),
    );
  });
  it("does not push other migrations/functions, change passwords, or delete accounts", () => {
    const source = readFileSync(
      "scripts/deploy-stable-email-codes.mjs",
      "utf8",
    );
    const workflow = readFileSync(
      ".github/workflows/deploy-stable-email-codes.yml",
      "utf8",
    );
    expect(workflow).not.toContain("db push");
    expect(workflow).not.toContain("config push");
    expect(workflow.match(/supabase functions deploy /g)).toHaveLength(2);
    expect(workflow).toContain("Wait for the matching website release");
    expect(source).not.toContain("updateUser");
    expect(source).not.toContain("deleteUser");
    expect(source).toContain("logout?scope=local");
    expect(source).toContain('STABLE_EMAIL_CODES_ENABLED: "false"');
  });
});
