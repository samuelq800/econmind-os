"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { Eye, LoaderCircle, ShieldCheck } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";

export function ViewerInvitationEntry() {
  const { configured, endViewerSession, startViewerSession, viewerAccess, viewerLoading } = useAuth();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      await startViewerSession(code);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to verify this invitation code.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto grid min-h-[calc(100vh-8rem)] w-full max-w-2xl place-items-center px-5 py-16">
      <section className="w-full rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-7 shadow-2xl sm:p-10">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]">
          <Eye size={22} />
        </div>
        <p className="mt-6 text-[11px] font-extrabold uppercase tracking-[.18em] text-[var(--accent)]">EconMind OS · visitor access</p>
        <h1 className="mt-3 text-3xl font-bold tracking-[-.045em] sm:text-4xl">Enter with an invitation code</h1>
        <p className="mt-4 max-w-xl text-sm leading-7 text-[var(--ink-muted)]">
          View every public learning, League and simulation page without creating an account or joining a school. Invitation access is read-only: it cannot save, submit, claim a role, join a Team or change data.
        </p>

        {viewerLoading ? (
          <div className="mt-8 flex items-center gap-2 rounded-xl bg-[var(--canvas)] px-4 py-3 text-sm text-[var(--ink-muted)]">
            <LoaderCircle className="animate-spin" size={16} /> Checking existing viewer access…
          </div>
        ) : viewerAccess ? (
          <div className="mt-8 rounded-2xl border border-[var(--accent)]/30 bg-[var(--accent-soft)] p-5">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 shrink-0 text-[var(--accent)]" size={20} />
              <div>
                <h2 className="font-bold">View-only access is active</h2>
                <p className="mt-1 text-sm leading-6 text-[var(--ink-muted)]">You can now explore the platform without a school binding or saved personal data.</p>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link href="/" className="inline-flex h-10 items-center justify-center rounded-lg border border-transparent bg-[var(--accent)] px-4 text-sm font-semibold text-white transition-colors hover:bg-[var(--accent-strong)]">Continue to EconMind OS</Link>
              <Button type="button" variant="secondary" onClick={endViewerSession}>Leave viewer mode</Button>
            </div>
          </div>
        ) : !configured ? (
          <p className="mt-8 rounded-xl bg-[var(--red-soft)] p-4 text-sm text-[var(--red)]">This deployment is missing its public Supabase configuration.</p>
        ) : (
          <form className="mt-8 space-y-4" onSubmit={submit}>
            <label className="block text-xs font-bold">
              Invitation code
              <input
                required
                value={code}
                onChange={(event) => setCode(event.target.value)}
                autoComplete="one-time-code"
                className="mt-2 h-12 w-full rounded-xl border border-[var(--line-strong)] bg-[var(--canvas)] px-4 font-mono text-sm tracking-[.08em] uppercase outline-none focus:border-[var(--accent)]"
                placeholder="VIEW-XXXXXXXXXXXX"
              />
            </label>
            {error && <p role="alert" className="rounded-xl bg-[var(--red-soft)] p-3 text-sm leading-6 text-[var(--red)]">{error}</p>}
            <Button className="w-full" disabled={busy} type="submit">
              {busy ? <LoaderCircle className="animate-spin" size={16} /> : <Eye size={16} />}
              Enter view-only mode
            </Button>
          </form>
        )}

        <p className="mt-6 text-center text-xs text-[var(--ink-muted)]">Need to save work or participate in a Team? <Link className="font-bold text-[var(--accent)]" href="/">Use a full account</Link>.</p>
      </section>
    </main>
  );
}
