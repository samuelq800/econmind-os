"use client";
import { useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { LoaderCircle, ShieldCheck } from "lucide-react";
import { useAuth } from "./auth-provider";
import { Button } from "@/components/ui/button";
import { RegistrationPolicyFields } from "@/components/legal/registration-policy-fields";
import { emptyRegistrationConsent } from "@/lib/legal/legal-config";
import { registrationConsentComplete } from "@/lib/legal/registration-consent";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { registerDirect } from "@/lib/supabase/direct-registration";

export function DirectRegistrationPage() {
  const { user, openAuth } = useAuth();
  const [identifier, setIdentifier] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [consent, setConsent] = useState(emptyRegistrationConsent);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submitting = useRef(false);
  const [consentUser, setConsentUser] = useState(user?.id);
  if (consentUser !== user?.id) {
    setConsentUser(user?.id);
    setConsent(emptyRegistrationConsent());
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (submitting.current || !registrationConsentComplete(consent)) return;
    if (password !== confirmation) {
      setError("Passwords do not match.");
      return;
    }
    const client = getSupabaseBrowserClient();
    if (!client) {
      setError("Registration is unavailable. Please retry later.");
      return;
    }
    submitting.current = true;
    setBusy(true);
    setError("");
    try {
      await registerDirect(client, {
        identifier,
        displayName,
        password,
        legalAcceptance: consent,
      });
      setPassword("");
      setConfirmation("");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Registration could not complete.",
      );
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }
  const inputClass =
    "mt-2 w-full rounded-xl border border-[var(--line)] bg-[var(--canvas)] px-4 py-3 text-base outline-none focus:border-[var(--accent)]";
  return (
    <main className="mx-auto max-w-2xl px-5 py-16 sm:py-24">
      <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.16em] text-[var(--accent)]">
        <ShieldCheck size={16} /> EconMind · Direct registration
      </p>
      <h1 className="mt-5 font-serif text-4xl sm:text-5xl">
        Create your account.
      </h1>
      <p className="mt-5 text-sm leading-7 text-[var(--ink-muted)]">
        Use any login ID, including a username, Chinese text or an email
        address. No invitation code or email verification code is required here.
        Remember your ID and password. IDs are case-insensitive.
      </p>
      <p className="mt-3 rounded-xl border border-[var(--line)] p-4 text-sm leading-6 text-[var(--ink-muted)]">
        A valid email address supports password recovery through the existing
        email verification process. Other IDs cannot use email recovery.
        Registration here does not verify ownership of an email address.
      </p>
      {user ? (
        <div
          role="status"
          className="mt-8 rounded-xl border border-[var(--line)] p-6"
        >
          <p>You are signed in. Your current account has not been changed.</p>
          <Link
            href="/season1/"
            className="mt-4 inline-block font-bold text-[var(--accent)]"
          >
            Continue to Season 1 →
          </Link>
        </div>
      ) : (
        <form
          onSubmit={(event) => void submit(event)}
          className="mt-8 grid gap-5"
        >
          <label className="text-sm font-bold">
            Login ID or email *
            <input
              required
              type="text"
              autoComplete="username"
              maxLength={128}
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="text-sm font-bold">
            Display name *
            <input
              required
              type="text"
              autoComplete="name"
              maxLength={80}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="text-sm font-bold">
            Password *
            <input
              required
              type="password"
              autoComplete="new-password"
              minLength={8}
              maxLength={1024}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="text-sm font-bold">
            Confirm password *
            <input
              required
              type="password"
              autoComplete="new-password"
              minLength={8}
              maxLength={1024}
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              className={inputClass}
            />
          </label>
          <RegistrationPolicyFields value={consent} onChange={setConsent} />
          {error && (
            <p
              role="alert"
              className="rounded-xl bg-[var(--red-soft)] p-4 text-sm text-[var(--red)]"
            >
              {error}
            </p>
          )}
          <Button
            type="submit"
            disabled={busy || !registrationConsentComplete(consent)}
          >
            {busy && <LoaderCircle size={16} className="animate-spin" />}Create
            account
          </Button>
          <div className="flex flex-wrap justify-between gap-4 text-sm">
            <button
              type="button"
              onClick={() => openAuth("sign-in")}
              className="text-[var(--accent)]"
            >
              Already registered? Sign in
            </button>
            <button
              type="button"
              onClick={() => openAuth("forgot-password")}
              className="text-[var(--accent)]"
            >
              Recover with a valid email
            </button>
          </div>
        </form>
      )}
    </main>
  );
}
