"use client";

import { Suspense } from "react";
import { ProfessorProjectDirectory } from "@/components/professor/professor-project-directory";

export default function ProfessorProjectsPage() {
  return <Suspense fallback={<main className="min-h-[65vh]" />}><ProfessorProjectDirectory /></Suspense>;
}
