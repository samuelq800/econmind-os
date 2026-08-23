"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CheckCircle2, LoaderCircle } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { LEGAL_DOCUMENTS, needsLegalReconsent } from "@/lib/legal/legal-config";
import { acceptCurrentLegalDocuments, listMyLegalConsents } from "@/lib/supabase/governance";

export function LegalConsentGate() {
  const { user, loading } = useAuth();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (loading || !user) return;
    let active = true;
    void listMyLegalConsents()
      .then((consents) => {
        if (!active) return;
        const accepted = Object.fromEntries(consents.map((consent) => [consent.document_type, consent.document_version]));
        setOpen(needsLegalReconsent(accepted));
      })
      .catch(() => {
        // A temporary request failure must not lock an existing account out of
        // the current release. A material-reconsent release can retry on focus.
        if (active) setOpen(false);
      })
    return () => { active = false; };
  }, [loading, user]);

  if (!user || !open) return null;

  async function acknowledge() {
    setBusy(true);
    setError("");
    try {
      await acceptCurrentLegalDocuments(LEGAL_DOCUMENTS.terms.version, LEGAL_DOCUMENTS.privacy.version);
      setOpen(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not record your acknowledgement.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[110] grid place-items-center bg-black/45 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="legal-consent-title">
      <section className="w-full max-w-lg rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6 shadow-2xl sm:p-7">
        <p className="text-[10px] font-extrabold uppercase tracking-[.18em] text-[var(--accent)]">Policy update</p>
        <h2 id="legal-consent-title" className="mt-3 text-2xl font-bold tracking-[-.035em]">Please review the updated documents</h2>
        <p className="mt-3 text-sm leading-6 text-[var(--ink-muted)]">A material update requires acknowledgement before you continue using this signed-in workspace.</p>
        <div className="mt-5 rounded-xl border border-[var(--line)] bg-[var(--canvas)] p-4 text-sm leading-6 text-[var(--ink-muted)]">
          <p><Link className="font-bold text-[var(--accent)]" href="/terms" target="_blank">Terms of Use v{LEGAL_DOCUMENTS.terms.version}</Link></p>
          <p className="mt-2"><Link className="font-bold text-[var(--accent)]" href="/privacy" target="_blank">Privacy Notice v{LEGAL_DOCUMENTS.privacy.version}</Link></p>
        </div>
        {error && <p role="alert" className="mt-4 rounded-lg bg-[var(--red-soft)] p-3 text-xs leading-5 text-[var(--red)]">{error}</p>}
        <Button className="mt-6 w-full" onClick={() => void acknowledge()} disabled={busy}>{busy ? <LoaderCircle size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}Acknowledge and continue</Button>
      </section>
    </div>
  );
}
