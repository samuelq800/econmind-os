import { Suspense } from "react";
import { ScenarioStudio } from "@/components/league/scenario-studio";

export default function SimulationScenarioStudioPage() {
  return <Suspense fallback={null}><ScenarioStudio basePath="/simulation/scenario-studio" worldPath="/simulation/world" /></Suspense>;
}
