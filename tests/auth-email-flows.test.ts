import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

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

describe("Supabase email verification and password recovery", () => {
  it("keeps registration consent metadata and requires an email OTP step", () => {
    expect(dialog).toContain("legal_acceptance");
    expect(dialog).toContain('"verify-sign-up",');
    expect(dialog).toContain('type: "email"');
    expect(dialog).toContain('type: "signup"');
    expect(dialog).toContain("Create account & send code");
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
    expect(config).toContain("[auth.email.template.confirmation]");
    expect(config).toContain("[auth.email.template.recovery]");
    for (const template of [confirmationTemplate, recoveryTemplate]) {
      expect(template).toContain("{{ .Token }}");
      expect(template).toContain("{{ .ConfirmationURL }}");
    }
  });
});
