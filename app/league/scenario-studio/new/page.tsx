import { ScenarioStudio } from "@/components/league/scenario-studio";
import { Suspense } from "react";
export default function NewScenarioPage() { return <Suspense fallback={null}><ScenarioStudio focus="new" /></Suspense>; }
