import { Suspense } from "react";
import { ResearchPaperDetail } from "@/components/research/research-library";
export default function ResearchPaperPage() { return <Suspense fallback={<main className="min-h-[65vh]" />}><ResearchPaperDetail /></Suspense>; }
