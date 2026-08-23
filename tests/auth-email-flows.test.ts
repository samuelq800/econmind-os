import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
  EMAIL_VERIFICATION_CONFIGURATION_ERROR,
  normaliseEmailOtp,
  rejectUnexpectedSignupSession,
} from "../lib/supabase/signup-verification";

const dialog = readFileSync("components/auth/auth-dialog.tsx", "utf8");
const provider = readFileSync("components/auth/auth-provider.tsx", "utf8");
const onboarding = readFileSync(
  "components/auth/account-onboarding.tsx",
  "utf8",
);
const config = readFileSync("supabase/config.toml", "utf8");
const confirmationTemplate = readFileSync(
  "supabase/templates/confirmation.html",
  "utf8",
);
const recoveryTemplate = readFileSync(
  "supabase/templates/recovery.html",
  "utf8",
);
const backendWorkflow = readFileSync(
  ".github/workflows/deploy-supabase.yml",
  "utf8",
);

describe("Supabase email verification and password recovery", () => {
  it("keeps registration consent metadata and requires an email OTP step", () => {
    expect(dialog).toContain("legal_acceptance");
    expect(dialog).toContain('"verify-sign-up",');
    expect(dialog).toContain('type: "email"');
    expect(dialog).toContain('type: "signup"');
    expect(dialog).toContain("Create account & send code");
    expect(dialog).not.toContain("if (data.session) closeAuth()");
    expect(dialog).toContain("rejectUnexpectedSignupSession(data.session");
    expect(dialog).toContain('pattern="[0-9]{8}"');
  });

  it("fails closed when Supabase unexpectedly returns a signup session", async () => {
    const signOut = vi.fn().mockResolvedValue({ error: null });

    await expect(
      rejectUnexpectedSignupSession({ access_token: "unexpected" }, signOut),
    ).rejects.toThrow(EMAIL_VERIFICATION_CONFIGURATION_ERROR);
    expect(signOut).toHaveBeenCalledOnce();
  });

  it("continues to the OTP step only when signup has no session", async () => {
    const signOut = vi.fn().mockResolvedValue({ error: null });

    await expect(
      rejectUnexpectedSignupSession(null, signOut),
    ).resolves.toBeUndefined();
    expect(signOut).not.toHaveBeenCalled();
  });

  it("propagates a failed safety sign-out and normalises the configured OTP", async () => {
    const signOutError = new Error("Could not close the unexpected session");
    const signOut = vi.fn().mockResolvedValue({ error: signOutError });

    await expect(
      rejectUnexpectedSignupSession({ access_token: "unexpected" }, signOut),
    ).rejects.toBe(signOutError);
    expect(normaliseEmailOtp(" 12a34-567890 ")).toBe("12345678");
  });

  it("verifies recovery email before allowing a matching new password", () => {
    expect(dialog).toContain("resetPasswordForEmail");
    expect(dialog).toContain('type: "recovery"');
    expect(dialog).toContain('openAuth("reset-password")');
    expect(dialog).toContain("password !== passwordConfirmation");
    expect(dialog).toMatch(/updateUser\(\{\s*password,?\s*\}\)/);
  });

  it("handles recovery links without exposing a recovery session behind the dialog", () => {
    expect(provider).toContain('event === "PASSWORD_RECOVERY"');
    expect(provider).toContain('setAuthMode("reset-password")');
    expect(dialog).toContain('authMode === "reset-password"');
    expect(dialog).toContain("await signOut()");
    expect(onboarding).toContain("authOpen");
  });

  it("ships local OTP templates while retaining secure-link fallback", () => {
    expect(config).toContain("enable_confirmations = true");
    expect(config).toContain('site_url = "https://econmind.group"');
    expect(config).toContain("otp_length = 8");
    expect(config).toMatch(/\[storage\.vector\]\s+enabled = false/);
    expect(config).toContain("[auth.email.template.confirmation]");
    expect(config).toContain("[auth.email.template.recovery]");
    for (const template of [confirmationTemplate, recoveryTemplate]) {
      expect(template).toContain("{{ .Token }}");
      expect(template).toContain("{{ .ConfirmationURL }}");
    }
  });

  it("deploys hosted Auth configuration only through an explicit workflow input", () => {
    expect(backendWorkflow).toContain("apply_auth_config:");
    expect(backendWorkflow).toContain("version: 2.115.0");
    expect(backendWorkflow).toContain(
      'supabase config push --project-ref "$SUPABASE_PROJECT_REF"',
    );
    expect(backendWorkflow).toMatch(/apply_auth_config:[\s\S]*?default: false/);
  });
});
