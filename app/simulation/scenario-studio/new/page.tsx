import { Suspense } from "react";
import { ScenarioStudio } from "@/components/league/scenario-studio";

export default function SimulationNewScenarioPage() {
  return <Suspense fallback={null}><ScenarioStudio focus="new" basePath="/simulation/scenario-studio" worldPath="/simulation/world" /></Suspense>;
}
