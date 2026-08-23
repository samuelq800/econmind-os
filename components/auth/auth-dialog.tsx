"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import {
  CheckCircle2,
  Eye,
  KeyRound,
  LoaderCircle,
  MailCheck,
  X,
} from "lucide-react";
import { useAuth, type AuthMode } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { BASE_PATH } from "@/lib/base-path";
import {
  LEGAL_DOCUMENTS,
  registrationConsentValid,
} from "@/lib/legal/legal-config";
import {
  OFFICIAL_CONTACT_EMAIL,
  OFFICIAL_CONTACT_MAILTO,
} from "@/lib/platform/contact";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  EMAIL_OTP_LENGTH,
  normaliseEmailOtp,
  rejectUnexpectedSignupSession,
} from "@/lib/supabase/signup-verification";

function emailRedirectUrl(flow?: "recovery" | "confirmed") {
  const redirectPath = BASE_PATH ? `${BASE_PATH}/` : "/";
  const url = new URL(redirectPath, window.location.origin);
  if (flow) url.searchParams.set("auth", flow);
  return url.toString();
}

function titleForMode(mode: AuthMode) {
  switch (mode) {
    case "invitation":
      return "Enter with invitation code";
    case "sign-in":
      return "Welcome back";
    case "sign-up":
      return "Create your account";
    case "verify-sign-up":
      return "Verify your email";
    case "forgot-password":
      return "Recover your account";
    case "verify-recovery":
      return "Verify the recovery code";
    case "reset-password":
      return "Set a new password";
  }
}

function descriptionForMode(mode: AuthMode, verificationEmail: string) {
  switch (mode) {
    case "invitation":
      return "Invitation access lets you explore every page without an account, school binding, saved work, or permission to make changes.";
    case "sign-in":
      return "Sign in to access your cloud scenarios and learning history.";
    case "sign-up":
      return "Your saved work stays private under Supabase Row Level Security. We verify your email before activating the account.";
    case "verify-sign-up":
      return `Enter the one-time code sent to ${verificationEmail || "your email"}.`;
    case "forgot-password":
      return "Enter your account email. If it matches an account, Supabase will send a one-time recovery code.";
    case "verify-recovery":
      return `Confirm the one-time code sent to ${verificationEmail || "your email"} before choosing a new password.`;
    case "reset-password":
      return "Your email has been verified. Choose a new password to finish the secure recovery session.";
  }
}

const otpModes: AuthMode[] = ["verify-sign-up", "verify-recovery"];

export function AuthDialog() {
  const {
    authOpen,
    authMode,
    closeAuth,
    openAuth,
    configured,
    signOut,
    startViewerSession,
  } = useAuth();
  const [email, setEmail] = useState("");
  const [verificationEmail, setVerificationEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [invitationCode, setInvitationCode] = useState("");
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [legalAcceptance, setLegalAcceptance] = useState({
    terms: false,
    privacy: false,
  });

  useEffect(() => {
    if (!authOpen) return;
    queueMicrotask(() => {
      setError("");
      setMessage("");
    });
  }, [authOpen]);

  useEffect(() => {
    if (!authOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) void closeSafely();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  if (!authOpen) return null;

  async function closeSafely() {
    if (busy) return;
    if (authMode === "reset-password") {
      try {
        await signOut();
      } finally {
        closeAuth();
      }
      return;
    }
    closeAuth();
  }

  function showOtpStep(
    mode: "verify-sign-up" | "verify-recovery",
    targetEmail: string,
    nextMessage: string,
  ) {
    setVerificationEmail(targetEmail);
    setOtp("");
    openAuth(mode);
    setMessage(nextMessage);
  }

  async function resendCode() {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !verificationEmail || !otpModes.includes(authMode)) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (authMode === "verify-sign-up") {
        const { error: resendError } = await supabase.auth.resend({
          type: "signup",
          email: verificationEmail,
          options: { emailRedirectTo: emailRedirectUrl("confirmed") },
        });
        if (resendError) throw resendError;
      } else {
        const { error: resendError } =
          await supabase.auth.resetPasswordForEmail(verificationEmail, {
            redirectTo: emailRedirectUrl("recovery"),
          });
        if (resendError) throw resendError;
      }
      setMessage(
        "A new code has been sent. Use the latest email; older codes may no longer work.",
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not resend the verification code.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setError("Supabase is not configured for this deployment.");
      return;
    }
    if (authMode === "sign-up" && !registrationConsentValid(legalAcceptance)) {
      setError(
        "Please read and accept the Terms of Use and Privacy Notice to create an account.",
      );
      return;
    }

    setBusy(true);
    try {
      if (authMode === "invitation") {
        await startViewerSession(invitationCode);
        closeAuth();
      } else if (authMode === "sign-in") {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (signInError) throw signInError;
        closeAuth();
      } else if (authMode === "sign-up") {
        const targetEmail = email.trim();
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: targetEmail,
          password,
          options: {
            data: {
              display_name: displayName.trim() || null,
              legal_acceptance: {
                terms_version: LEGAL_DOCUMENTS.terms.version,
                privacy_version: LEGAL_DOCUMENTS.privacy.version,
              },
            },
            emailRedirectTo: emailRedirectUrl("confirmed"),
          },
        });
        if (signUpError) throw signUpError;
        setPassword("");
        await rejectUnexpectedSignupSession(data.session, () =>
          supabase.auth.signOut(),
        );
        showOtpStep(
          "verify-sign-up",
          targetEmail,
          "Check your inbox for the email verification code.",
        );
      } else if (authMode === "verify-sign-up") {
        const { error: verificationError } = await supabase.auth.verifyOtp({
          email: verificationEmail,
          token: otp.trim(),
          type: "email",
        });
        if (verificationError) throw verificationError;
        setOtp("");
        setPassword("");
        closeAuth();
      } else if (authMode === "forgot-password") {
        const targetEmail = email.trim();
        const { error: recoveryError } =
          await supabase.auth.resetPasswordForEmail(targetEmail, {
            redirectTo: emailRedirectUrl("recovery"),
          });
        if (recoveryError) throw recoveryError;
        showOtpStep(
          "verify-recovery",
          targetEmail,
          "If that address belongs to an account, a recovery code has been sent.",
        );
      } else if (authMode === "verify-recovery") {
        const { error: verificationError } = await supabase.auth.verifyOtp({
          email: verificationEmail,
          token: otp.trim(),
          type: "recovery",
        });
        if (verificationError) throw verificationError;
        setOtp("");
        openAuth("reset-password");
        setMessage("Email verified. Set your new password now.");
      } else {
        if (password.length < 8)
          throw new Error("Use at least 8 characters for your new password.");
        if (password !== passwordConfirmation)
          throw new Error("The two password entries do not match.");
        const { error: updateError } = await supabase.auth.updateUser({
          password,
        });
        if (updateError) throw updateError;
        setPassword("");
        setPasswordConfirmation("");
        closeAuth();
      }
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Authentication failed.",
      );
    } finally {
      setBusy(false);
    }
  }

  const isOtpStep = otpModes.includes(authMode);
  const isResetStep = authMode === "reset-password";
  const showEmail =
    authMode === "sign-in" ||
    authMode === "sign-up" ||
    authMode === "forgot-password";
  const showPassword =
    authMode === "sign-in" || authMode === "sign-up" || isResetStep;

  return (
    <div
      className="fixed inset-0 z-[120] grid place-items-center bg-black/45 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) void closeSafely();
      }}
    >
      <div className="w-full max-w-md rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6 shadow-2xl sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-[var(--accent)]">
              {isOtpStep
                ? "Encrypted email checkpoint"
                : isResetStep
                  ? "Secure password recovery"
                  : "Supabase account"}
            </p>
            <h2
              id="auth-title"
              className="mt-2 text-2xl font-bold tracking-[-.035em]"
            >
              {titleForMode(authMode)}
            </h2>
            <p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">
              {descriptionForMode(authMode, verificationEmail)}
            </p>
          </div>
          <button
            type="button"
            aria-label={
              isResetStep
                ? "Cancel password reset and sign out"
                : "Close account dialog"
            }
            disabled={busy}
            onClick={() => void closeSafely()}
            className="grid size-9 shrink-0 place-items-center rounded-lg border border-[var(--line)] disabled:opacity-45"
          >
            <X size={16} />
          </button>
        </div>

        {!configured ? (
          <p className="mt-6 rounded-lg bg-[var(--red-soft)] p-3 text-sm text-[var(--red)]">
            This deployment is missing its public Supabase configuration.
          </p>
        ) : (
          <form className="mt-6 space-y-4" onSubmit={submit}>
            {authMode === "invitation" && (
              <label className="block text-xs font-bold">
                Invitation code
                <input
                  required
                  value={invitationCode}
                  onChange={(event) => setInvitationCode(event.target.value)}
                  autoComplete="one-time-code"
                  className="mt-2 h-11 w-full rounded-lg border border-[var(--line-strong)] bg-[var(--canvas)] px-3 font-mono text-sm tracking-[.08em] uppercase outline-none focus:border-[var(--accent)]"
                  placeholder="VIEW-XXXXXXXXXXXX"
                />
              </label>
            )}

            {authMode === "sign-up" && (
              <label className="block text-xs font-bold">
                Display name
                <input
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  maxLength={80}
                  autoComplete="name"
                  className="mt-2 h-11 w-full rounded-lg border border-[var(--line-strong)] bg-[var(--canvas)] px-3 text-sm outline-none focus:border-[var(--accent)]"
                  placeholder="Optional"
                />
              </label>
            )}

            {showEmail && (
              <label className="block text-xs font-bold">
                Email
                <input
                  required
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  className="mt-2 h-11 w-full rounded-lg border border-[var(--line-strong)] bg-[var(--canvas)] px-3 text-sm outline-none focus:border-[var(--accent)]"
                  placeholder="you@example.com"
                />
              </label>
            )}

            {isOtpStep && (
              <label className="block text-xs font-bold">
                Email verification code
                <input
                  required
                  autoFocus
                  value={otp}
                  onChange={(event) =>
                    setOtp(normaliseEmailOtp(event.target.value))
                  }
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  minLength={EMAIL_OTP_LENGTH}
                  maxLength={EMAIL_OTP_LENGTH}
                  pattern="[0-9]{8}"
                  title="Enter the 8-digit code from your email"
                  className="mt-2 h-12 w-full rounded-lg border border-[var(--line-strong)] bg-[var(--canvas)] px-3 text-center font-mono text-lg font-bold tracking-[.24em] outline-none focus:border-[var(--accent)]"
                  placeholder="8-DIGIT CODE"
                />
              </label>
            )}

            {showPassword && (
              <label className="block text-xs font-bold">
                {isResetStep ? "New password" : "Password"}
                <input
                  required
                  type="password"
                  minLength={8}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete={
                    authMode === "sign-in" ? "current-password" : "new-password"
                  }
                  className="mt-2 h-11 w-full rounded-lg border border-[var(--line-strong)] bg-[var(--canvas)] px-3 text-sm outline-none focus:border-[var(--accent)]"
                  placeholder="At least 8 characters"
                />
              </label>
            )}

            {isResetStep && (
              <label className="block text-xs font-bold">
                Confirm new password
                <input
                  required
                  type="password"
                  minLength={8}
                  value={passwordConfirmation}
                  onChange={(event) =>
                    setPasswordConfirmation(event.target.value)
                  }
                  autoComplete="new-password"
                  className="mt-2 h-11 w-full rounded-lg border border-[var(--line-strong)] bg-[var(--canvas)] px-3 text-sm outline-none focus:border-[var(--accent)]"
                  placeholder="Enter the same password again"
                />
              </label>
            )}

            {authMode === "sign-up" && (
              <fieldset className="grid gap-3 rounded-xl border border-[var(--line)] bg-[var(--canvas)] p-4">
                <legend className="sr-only">Legal acknowledgements</legend>
                <label className="flex cursor-pointer items-start gap-3 text-xs leading-5 text-[var(--ink-muted)]">
                  <input
                    required
                    type="checkbox"
                    checked={legalAcceptance.terms}
                    onChange={(event) =>
                      setLegalAcceptance((current) => ({
                        ...current,
                        terms: event.target.checked,
                      }))
                    }
                    className="mt-1 size-4 accent-[var(--accent)]"
                  />
                  <span>
                    I have read and agree to the{" "}
                    <Link
                      href="/terms"
                      target="_blank"
                      className="font-bold text-[var(--accent)]"
                    >
                      Terms of Use
                    </Link>
                    .
                  </span>
                </label>
                <label className="flex cursor-pointer items-start gap-3 text-xs leading-5 text-[var(--ink-muted)]">
                  <input
                    required
                    type="checkbox"
                    checked={legalAcceptance.privacy}
                    onChange={(event) =>
                      setLegalAcceptance((current) => ({
                        ...current,
                        privacy: event.target.checked,
                      }))
                    }
                    className="mt-1 size-4 accent-[var(--accent)]"
                  />
                  <span>
                    I have read the{" "}
                    <Link
                      href="/privacy"
                      target="_blank"
                      className="font-bold text-[var(--accent)]"
                    >
                      Privacy Notice
                    </Link>
                    .
                  </span>
                </label>
              </fieldset>
            )}

            {error && (
              <p
                role="alert"
                className="rounded-lg bg-[var(--red-soft)] p-3 text-xs leading-5 text-[var(--red)]"
              >
                {error}
              </p>
            )}
            {message && (
              <p className="flex gap-2 rounded-lg bg-[var(--accent-soft)] p-3 text-xs leading-5 text-[var(--accent)]">
                <CheckCircle2 className="mt-.5 shrink-0" size={15} />
                {message}
              </p>
            )}

            <Button
              className="w-full"
              disabled={
                busy ||
                (authMode === "sign-up" &&
                  !registrationConsentValid(legalAcceptance))
              }
              type="submit"
            >
              {busy && <LoaderCircle className="animate-spin" size={15} />}
              {authMode === "invitation" ? (
                <>
                  <Eye size={15} /> Enter view-only mode
                </>
              ) : authMode === "sign-in" ? (
                "Sign in"
              ) : authMode === "sign-up" ? (
                "Create account & send code"
              ) : authMode === "forgot-password" ? (
                <>
                  <KeyRound size={15} /> Send recovery code
                </>
              ) : authMode === "reset-password" ? (
                "Save new password"
              ) : (
                <>
                  <MailCheck size={15} /> Verify email
                </>
              )}
            </Button>

            {isOtpStep && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void resendCode()}
                className="w-full text-center text-xs font-bold text-[var(--accent)] disabled:opacity-45"
              >
                Send a new code
              </button>
            )}
          </form>
        )}

        {authMode === "sign-in" && (
          <button
            type="button"
            className="mt-4 w-full text-center text-xs font-bold text-[var(--accent)]"
            onClick={() => {
              setError("");
              setMessage("");
              openAuth("forgot-password");
            }}
          >
            Forgot your password?
          </button>
        )}

        {!isResetStep && (
          <p className="mt-5 text-center text-xs text-[var(--ink-muted)]">
            {authMode === "sign-in"
              ? "New to EconMind OS?"
              : authMode === "sign-up"
                ? "Already have an account?"
                : "Return to your account?"}{" "}
            <button
              type="button"
              className="font-bold text-[var(--accent)]"
              onClick={() => {
                setError("");
                setMessage("");
                openAuth(authMode === "sign-in" ? "sign-up" : "sign-in");
              }}
            >
              {authMode === "sign-in" ? "Create one" : "Sign in"}
            </button>
          </p>
        )}
        {authMode === "sign-in" && (
          <p className="mt-3 text-center text-xs leading-5 text-[var(--ink-muted)]">
            Need account access support?{" "}
            <a
              href={OFFICIAL_CONTACT_MAILTO}
              className="font-bold text-[var(--accent)]"
            >
              {OFFICIAL_CONTACT_EMAIL}
            </a>
          </p>
        )}
        {(authMode === "sign-in" ||
          authMode === "sign-up" ||
          authMode === "invitation") && (
          <p className="mt-3 text-center text-xs text-[var(--ink-muted)]">
            Have a viewing invitation?{" "}
            <button
              type="button"
              className="font-bold text-[var(--accent)]"
              onClick={() => {
                setError("");
                setMessage("");
                openAuth("invitation");
              }}
            >
              Enter code
            </button>
          </p>
        )}
      </div>
    </div>
  );
}
