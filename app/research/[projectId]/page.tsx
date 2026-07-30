import { notFound } from "next/navigation";
import { EvidenceProjectWorkspace } from "@/components/learning/evidence-lab/evidence-workspace";
import {
  EVIDENCE_PROJECTS,
  getEvidenceProject,
} from "@/lib/evidence-lab/projects";

export function generateStaticParams() {
  return EVIDENCE_PROJECTS.map((project) => ({ projectId: project.slug }));
}

export default async function EvidenceProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const project = getEvidenceProject(projectId);
  if (!project) notFound();
  return <EvidenceProjectWorkspace project={project} />;
}
