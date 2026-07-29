"use client";

import { LockKeyhole, LoaderCircle } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";

/**
 * Keeps the whole application behind an individual EconMind account. This is
 * deliberately placed in the root layout so direct links and static Pages
 * routes follow the same rule as navigation from the home page.
 */
export function RegisteredAppGate({ children }: { children: React.ReactNode }) {
  const { user, loading, configured, openAuth } = useAuth();

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center bg-[var(--canvas)] px-5" aria-live="polite">
        <div className="flex items-center gap-3 text-sm font-semibold text-[var(--ink-muted)]">
          <LoaderCircle className="animate-spin text-[var(--accent)]" size={18} />
          Checking your secure session…
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="grid min-h-screen place-items-center bg-[var(--canvas)] px-5 py-10">
        <section className="w-full max-w-lg rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-7 text-center shadow-sm sm:p-10">
          <span className="mx-auto grid size-12 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
            <LockKeyhole size={22} />
          </span>
          <p className="mt-6 text-[10px] font-extrabold uppercase tracking-[.18em] text-[var(--accent)]">Individual access required</p>
          <h1 className="mt-3 text-3xl font-bold tracking-[-.045em] sm:text-4xl">Create an account to enter EconMind OS.</h1>
          <p className="mt-4 text-sm leading-6 text-[var(--ink-muted)]">
            All models, cases, news and League activities are available only to registered individual accounts.
          </p>
          {!configured ? (
            <p className="mt-6 rounded-lg bg-[var(--red-soft)] p-3 text-sm text-[var(--red)]">
              Account access is not configured for this deployment yet.
            </p>
          ) : (
            <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
              <Button onClick={() => openAuth("sign-up")}>Create individual account</Button>
              <Button variant="secondary" onClick={() => openAuth("sign-in")}>Sign in</Button>
            </div>
          )}
        </section>
      </main>
    );
  }

  return <>{children}</>;
}
