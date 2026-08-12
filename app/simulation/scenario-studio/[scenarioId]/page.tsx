import { redirect } from "next/navigation";

export function generateStaticParams() { return [{ scenarioId: "preview" }]; }
export default function SimulationScenarioDynamicCompatibilityPage() { redirect("/simulation/scenario-studio/editor"); }
