import { Suspense } from "react";
import { ScenarioStudio } from "@/components/league/scenario-studio";

export default function ScenarioStudioPage() { return <Suspense fallback={null}><ScenarioStudio /></Suspense>; }
