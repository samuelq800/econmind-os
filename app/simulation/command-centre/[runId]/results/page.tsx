import { redirect } from "next/navigation";

export function generateStaticParams() { return [{ runId: "preview" }]; }
export default function SimulationCommandCentreResultCompatibilityPage() { redirect("/simulation/command-centre/run/results"); }
