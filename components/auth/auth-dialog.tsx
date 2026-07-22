"use client";

import { FormEvent, useEffect, useState } from "react";
import { CheckCircle2, LoaderCircle, X } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

function emailRedirectUrl() {
  const basePath = window.location.pathname.startsWith("/econmind-os")
    ? "/econmind-os/"
    : "/";
  return `${window.location.origin}${basePath}`;
}

export function AuthDialog() {
  const { authOpen, authMode, closeAuth, openAuth, configured } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!authOpen) return;
    queueMicrotask(() => {
      setError("");
      setMessage("");
    });
  }, [authOpen, authMode]);

  if (!authOpen) return null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setError("Supabase is not configured for this deployment.");
      return;
    }

    setBusy(true);
    try {
      if (authMode === "sign-in") {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (signInError) throw signInError;
        closeAuth();
      } else {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { display_name: displayName.trim() || null },
            emailRedirectTo: emailRedirectUrl(),
          },
        });
        if (signUpError) throw signUpError;
        if (data.session) closeAuth();
        else setMessage("Check your inbox and confirm your email to finish creating the account.");
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Authentication failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] grid place-items-center bg-black/45 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) closeAuth();
      }}
    >
      <div className="w-full max-w-md rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6 shadow-2xl sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-[var(--accent)]">
              Supabase account
            </p>
            <h2 id="auth-title" className="mt-2 text-2xl font-bold tracking-[-.035em]">
              {authMode === "sign-in" ? "Welcome back" : "Create your account"}
            </h2>
            <p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">
              {authMode === "sign-in"
                ? "Sign in to access your cloud scenarios and learning history."
                : "Your saved work stays private under Supabase Row Level Security."}
            </p>
          </div>
          <button
            type="button"
            aria-label="Close account dialog"
            onClick={closeAuth}
            className="grid size-9 shrink-0 place-items-center rounded-lg border border-[var(--line)]"
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
            <label className="block text-xs font-bold">
              Password
              <input
                required
                type="password"
                minLength={8}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete={authMode === "sign-in" ? "current-password" : "new-password"}
                className="mt-2 h-11 w-full rounded-lg border border-[var(--line-strong)] bg-[var(--canvas)] px-3 text-sm outline-none focus:border-[var(--accent)]"
                placeholder="At least 8 characters"
              />
            </label>
            {error && (
              <p role="alert" className="rounded-lg bg-[var(--red-soft)] p-3 text-xs leading-5 text-[var(--red)]">
                {error}
              </p>
            )}
            {message && (
              <p className="flex gap-2 rounded-lg bg-[var(--accent-soft)] p-3 text-xs leading-5 text-[var(--accent)]">
                <CheckCircle2 className="mt-.5 shrink-0" size={15} />
                {message}
              </p>
            )}
            <Button className="w-full" disabled={busy} type="submit">
              {busy && <LoaderCircle className="animate-spin" size={15} />}
              {authMode === "sign-in" ? "Sign in" : "Create account"}
            </Button>
          </form>
        )}

        <p className="mt-5 text-center text-xs text-[var(--ink-muted)]">
          {authMode === "sign-in" ? "New to EconMind OS?" : "Already have an account?"}{" "}
          <button
            type="button"
            className="font-bold text-[var(--accent)]"
            onClick={() => openAuth(authMode === "sign-in" ? "sign-up" : "sign-in")}
          >
            {authMode === "sign-in" ? "Create one" : "Sign in"}
          </button>
        </p>
      </div>
    </div>
  );
}
