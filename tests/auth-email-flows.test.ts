import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
  authEmailRequestErrorMessage,
  EMAIL_RESEND_COOLDOWN_SECONDS,
  EMAIL_VERIFICATION_CONFIGURATION_ERROR,
  isAuthEmailRateLimitError,
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
    expect(dialog).toContain("Submit registration");
    expect(dialog).not.toContain("if (data.session) closeAuth()");
    expect(dialog).toContain("rejectUnexpectedSignupSession(data.session");
    expect(dialog).toContain('pattern="[0-9]{8}"');
  });

  it("keeps accepted signup requests neutral and account-enumeration safe", () => {
    const signupImplementation = dialog.slice(
      dialog.indexOf('} else if (authMode === "sign-up") {'),
      dialog.indexOf('} else if (authMode === "verify-sign-up") {'),
    );
    const verifySignupNavigation = dialog.slice(
      dialog.indexOf('{authMode === "verify-sign-up" && ('),
      dialog.indexOf('{authMode === "sign-in" && ('),
    );

    expect(signupImplementation).toContain(
      "If this email is eligible for registration, a verification code has been requested.",
    );
    expect(signupImplementation).toContain("sign in or reset your password");
    expect(signupImplementation).toContain("authEmailRequestErrorMessage(");
    expect(signupImplementation).not.toMatch(
      /verification email (?:was |has been )?sent|already registered|account exists/i,
    );
    expect(signupImplementation).not.toContain(".identities");
    expect(signupImplementation).not.toContain("auth.admin");
    expect(verifySignupNavigation.match(/disabled=\{busy\}/g)).toHaveLength(2);
  });

  it("uses the signup resend API without repeating signup", () => {
    const resendImplementation = dialog.slice(
      dialog.indexOf("async function resendCode"),
      dialog.indexOf("async function submit"),
    );
    expect(resendImplementation).toMatch(
      /if \(authMode === "verify-sign-up"\) \{[\s\S]*?supabase\.auth\.resend\(\{\s*type: "signup",\s*email: verificationEmail,\s*options: \{ emailRedirectTo: emailRedirectUrl\("confirmed"\) \},\s*\}\);/,
    );
    expect(resendImplementation).toMatch(
      /\} else \{[\s\S]*?resetPasswordForEmail\(verificationEmail, \{\s*redirectTo: emailRedirectUrl\("recovery"\),\s*\}\);/,
    );
    expect(resendImplementation).not.toContain("auth.signUp");
  });

  it("matches resend cooldown UX to the configured one-minute send window", () => {
    const resendImplementation = dialog.slice(
      dialog.indexOf("async function resendCode"),
      dialog.indexOf("async function submit"),
    );
    const formEnd = dialog.indexOf("</form>");
    const resendButton = dialog.slice(
      dialog.lastIndexOf("{isOtpStep && (", formEnd),
      formEnd,
    );

    expect(EMAIL_RESEND_COOLDOWN_SECONDS).toBe(60);
    expect(config).toContain('max_frequency = "1m0s"');
    expect(dialog).toMatch(
      /if \(resendCooldown <= 0\) return;[\s\S]*?Math\.max\(0, current - 1\)[\s\S]*?\}, \[resendCooldown\]\);/,
    );
    expect(resendImplementation).toMatch(
      /busy \|\|\s*resendCooldown > 0[\s\S]*?return;/,
    );
    expect(resendImplementation).toMatch(
      /setResendCooldown\(EMAIL_RESEND_COOLDOWN_SECONDS\);\s*setMessage\(/,
    );
    expect(resendImplementation).toMatch(
      /if \(isAuthEmailRateLimitError\(caught\)\) \{\s*setResendCooldown\(EMAIL_RESEND_COOLDOWN_SECONDS\);/,
    );
    expect(resendButton).toContain("disabled={busy || resendCooldown > 0}");
    expect(resendButton).toContain("Request a new code in ${resendCooldown}s");
  });

  it("recognises each supported email rate-limit signal", () => {
    const fallback = "Could not submit the request.";
    const expected =
      "Too many email requests. Please wait a minute before trying again.";

    for (const rateLimitError of [
      { code: "over_email_send_rate_limit" },
      { code: "over_request_rate_limit" },
      { status: 429 },
    ]) {
      expect(isAuthEmailRateLimitError(rateLimitError)).toBe(true);
      expect(authEmailRequestErrorMessage(rateLimitError, fallback)).toBe(
        expected,
      );
    }
    expect(isAuthEmailRateLimitError({ code: "unknown", status: 400 })).toBe(
      false,
    );
  });

  it("maps email request failures without exposing backend messages", () => {
    const fallback = "Could not submit the request.";
    const retryableFetchError = new Error("opaque network failure");
    retryableFetchError.name = "AuthRetryableFetchError";
    const cases: Array<[unknown, string]> = [
      [{ code: "email_address_invalid" }, "Enter a valid email address."],
      [{ message: "Invalid email format" }, "Enter a valid email address."],
      [
        retryableFetchError,
        "We could not reach the authentication service. Check your connection and try again.",
      ],
      [
        new TypeError("Failed to fetch"),
        "We could not reach the authentication service. Check your connection and try again.",
      ],
      [
        { code: "unexpected_failure", message: "opaque provider failure" },
        "Authentication email could not be sent right now. Please try again later.",
      ],
      [
        { status: 500, message: "opaque provider failure" },
        "Authentication email could not be sent right now. Please try again later.",
      ],
      [
        { message: "SMTP credentials leaked" },
        "Authentication email could not be sent right now. Please try again later.",
      ],
      [
        { code: "weak_password" },
        "The password does not meet the account security requirements.",
      ],
      [
        { code: "email_address_not_authorized" },
        "This deployment cannot send authentication email to that address. Contact support if you believe this is a mistake.",
      ],
      [
        { code: "signup_disabled" },
        "Email authentication is temporarily unavailable.",
      ],
      [
        { code: "user_already_exists", message: "User already registered" },
        fallback,
      ],
      [
        new Error(EMAIL_VERIFICATION_CONFIGURATION_ERROR),
        EMAIL_VERIFICATION_CONFIGURATION_ERROR,
      ],
      [{ code: "unknown", message: "internal backend detail" }, fallback],
    ];

    for (const [caught, expected] of cases) {
      expect(authEmailRequestErrorMessage(caught, fallback)).toBe(expected);
    }
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
