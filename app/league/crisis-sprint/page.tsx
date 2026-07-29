"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Compatibility route for saved links from the first League release. */
export default function CrisisSprintPage() {
  const router = useRouter();
  useEffect(() => { queueMicrotask(() => router.replace("/league/quick-challenge")); }, [router]);
  return <main className="grid min-h-[60vh] place-items-center text-sm text-[var(--ink-muted)]">Opening Quick Policy Challenge…</main>;
}
