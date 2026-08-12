"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { CommandCentreRun } from "@/components/league/command-centre";

function SimulationRunFromQuery() {
  const runId = useSearchParams().get("run");
  if (!runId) return <main className="grid min-h-[65vh] place-items-center px-5 text-center text-sm text-[var(--ink-muted)]">Choose a saved run from Command Centre to continue.</main>;
  return <CommandCentreRun runId={runId} basePath="/simulation/command-centre" dashboardPath="/simulation/dashboard" />;
}

export default function SimulationCommandCentreRunPage() {
  return <Suspense fallback={<main className="grid min-h-[65vh] place-items-center text-sm text-[var(--ink-muted)]">Loading Command Centre…</main>}><SimulationRunFromQuery /></Suspense>;
}
