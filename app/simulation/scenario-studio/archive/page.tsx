import { Suspense } from "react";
import { ScenarioStudio } from "@/components/league/scenario-studio";

export default function SimulationArchivedScenariosPage() {
  return <Suspense fallback={null}><ScenarioStudio focus="archive" basePath="/simulation/scenario-studio" worldPath="/simulation/world" /></Suspense>;
}
