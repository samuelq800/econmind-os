import { redirect } from "next/navigation";

export function generateStaticParams() { return [{ runId: "preview" }]; }
export default function SimulationCommandCentreDynamicCompatibilityPage() { redirect("/simulation/command-centre/run"); }
