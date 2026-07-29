import { Suspense } from "react";
import { ScenarioStudio } from "@/components/league/scenario-studio";
export default function PublishedScenariosPage() { return <Suspense fallback={null}><ScenarioStudio focus="published" /></Suspense>; }
