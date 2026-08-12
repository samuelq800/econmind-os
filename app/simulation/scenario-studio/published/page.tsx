import { Suspense } from "react";
import { ScenarioStudio } from "@/components/league/scenario-studio";

export default function SimulationPublishedScenariosPage() {
  return <Suspense fallback={null}><ScenarioStudio focus="published" basePath="/simulation/scenario-studio" worldPath="/simulation/world" /></Suspense>;
}
