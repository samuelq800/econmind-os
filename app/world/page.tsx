import { WorldExperience } from "@/components/world/world-experience";
import { Suspense } from "react";
export default function WorldPage() { return <Suspense fallback={null}><WorldExperience /></Suspense>; }
