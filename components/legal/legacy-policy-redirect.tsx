"use client";
import Link from "next/link";
import { useEffect } from "react";
import { withBasePath } from "@/lib/base-path";
import { migratedPolicyHash } from "@/lib/legal/legacy-links";

/** GitHub Pages compatibility redirect, NOT an HTTP 301 response. */
export function LegacyPolicyRedirect({
  document,
  destination,
}: {
  document: string;
  destination: string;
}) {
  useEffect(() => {
    window.location.replace(
      `${withBasePath(destination)}${window.location.search}${migratedPolicyHash(document, window.location.hash)}`,
    );
  }, [document, destination]);
  return (
    <main className="mx-auto min-h-[65vh] max-w-3xl px-5 py-20">
      <p className="text-xs font-bold uppercase tracking-widest text-[var(--accent)]">
        Legal & Policies
      </p>
      <h1 className="mt-5 text-3xl font-bold">This document has moved.</h1>
      <p className="mt-5 text-sm leading-7 text-[var(--ink-muted)]">
        The official document is now part of the unified Legal Center. Your
        bookmark remains supported.
      </p>
      <Link
        href={destination}
        className="mt-6 inline-block font-bold text-[var(--accent)] underline"
      >
        Open the current document →
      </Link>
      <noscript>
        <meta
          httpEquiv="refresh"
          content={`0;url=${withBasePath(destination)}`}
        />
      </noscript>
    </main>
  );
}
