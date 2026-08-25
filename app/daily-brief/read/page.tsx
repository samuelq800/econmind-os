import type { Metadata } from "next";
import { Suspense } from "react";
import { BriefReader } from "@/components/daily-brief/brief-reader";

export const metadata: Metadata = {
  robots: { index: false, follow: true },
};

export default function BriefReaderPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto min-h-[65vh] max-w-3xl px-5 py-12 sm:px-8">
          <p className="text-sm text-[var(--ink-muted)]">Loading briefing…</p>
        </main>
      }
    >
      <BriefReader />
    </Suspense>
  );
}
