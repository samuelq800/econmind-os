import { Suspense } from "react";
import { ResearchSubmissionForm } from "@/components/research/research-library";
export default function SubmitResearchPage() { return <Suspense fallback={<main className="min-h-[65vh]" />}><ResearchSubmissionForm /></Suspense>; }
