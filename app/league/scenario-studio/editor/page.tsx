import { Suspense } from "react";
import { ScenarioStudio } from "@/components/league/scenario-studio";
export default function ScenarioEditorPage() { return <Suspense fallback={null}><ScenarioStudio focus="editor" /></Suspense>; }
