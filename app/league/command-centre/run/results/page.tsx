"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { CommandCentreResults } from "@/components/league/command-centre";

function ResultsFromQuery() {
  const runId = useSearchParams().get("run");
  if (!runId) return <main className="grid min-h-[65vh] place-items-center px-5 text-center text-sm text-[var(--ink-muted)]">Choose a completed run to view its result.</main>;
  return <CommandCentreResults runId={runId} />;
}

export default function CommandCentreResultsPage() {
  return <Suspense fallback={<main className="grid min-h-[65vh] place-items-center text-sm text-[var(--ink-muted)]">Loading final result…</main>}><ResultsFromQuery /></Suspense>;
}
