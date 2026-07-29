"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { CommandCentreRun } from "@/components/league/command-centre";

function RunFromQuery() {
  const runId = useSearchParams().get("run");
  if (!runId) return <main className="grid min-h-[65vh] place-items-center px-5 text-center text-sm text-[var(--ink-muted)]">Choose a saved run from Command Centre to continue.</main>;
  return <CommandCentreRun runId={runId} />;
}

export default function CommandCentreRunPage() {
  return <Suspense fallback={<main className="grid min-h-[65vh] place-items-center text-sm text-[var(--ink-muted)]">Loading Command Centre…</main>}><RunFromQuery /></Suspense>;
}
