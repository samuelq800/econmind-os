import { Suspense } from "react";
import { ScenarioStudio } from "@/components/league/scenario-studio";
export default function ArchivedScenariosPage() { return <Suspense fallback={null}><ScenarioStudio focus="archive" /></Suspense>; }
