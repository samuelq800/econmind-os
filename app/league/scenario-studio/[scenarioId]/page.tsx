import { redirect } from "next/navigation";

export function generateStaticParams() { return [{ scenarioId: "preview" }]; }
export default function ScenarioDynamicCompatibilityPage() { redirect("/league/scenario-studio/editor"); }
