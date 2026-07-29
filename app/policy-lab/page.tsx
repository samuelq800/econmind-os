"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Policy Lab now lives inside the personal Economic Sandbox. */
export default function PolicyLabPage() {
  const router = useRouter();
  useEffect(() => { queueMicrotask(() => router.replace("/sandbox")); }, [router]);
  return <main className="grid min-h-[60vh] place-items-center text-sm text-[var(--ink-muted)]">Opening Economic Sandbox &amp; Policy Lab…</main>;
}
