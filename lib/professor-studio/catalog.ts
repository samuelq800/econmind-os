import { ECONBENCH_CHALLENGES } from "@/lib/economics/econbench";
import { EVIDENCE_PROJECTS } from "@/lib/evidence-lab/projects";
import { mechanismScenarios } from "@/lib/mechanism-arena/catalog";
import { AVAILABLE_MODELS } from "@/lib/models/registry";

export type ProfessorProjectType =
  | "mechanism_arena"
  | "evidence_lab"
  | "econbench"
  | "model_assignment";

export type ProfessorProjectTemplate = {
  key: string;
  title: string;
  detail: string;
};

export const PROFESSOR_PROJECT_TYPES: Array<{
  key: ProfessorProjectType;
  label: string;
  description: string;
  action: string;
}> = [
  {
    key: "mechanism_arena",
    label: "Mechanism Arena",
    description: "Run a controlled strategic or institutional mechanism using a reviewed scenario.",
    action: "Launch an arena",
  },
  {
    key: "evidence_lab",
    label: "Evidence Lab",
    description: "Assign a structured research project with fixed teaching evidence and causal limits.",
    action: "Launch a research project",
  },
  {
    key: "econbench",
    label: "EconBench",
    description: "Set a multi-model policy challenge with a transparent objective and constraints.",
    action: "Launch a challenge",
  },
  {
    key: "model_assignment",
    label: "Model learning",
    description: "Create a guided model task or a formal browser-side experiment.",
    action: "Create an assignment",
  },
];

export function professorProjectTemplates(
  projectType: ProfessorProjectType,
): ProfessorProjectTemplate[] {
  if (projectType === "mechanism_arena") {
    return mechanismScenarios.map((scenario) => ({
      key: scenario.scenario_id,
      title: scenario.title,
      detail: `${scenario.category} · ${scenario.difficulty} · ${scenario.estimatedMinutes} min`,
    }));
  }
  if (projectType === "evidence_lab") {
    return EVIDENCE_PROJECTS.map((project) => ({
      key: project.slug,
      title: project.title,
      detail: `${project.category} · ${project.duration}`,
    }));
  }
  if (projectType === "econbench") {
    return ECONBENCH_CHALLENGES.map((challenge) => ({
      key: challenge.challenge_id,
      title: challenge.title,
      detail: `${challenge.meta.category} · ${challenge.meta.difficulty} · ${challenge.meta.minutes}`,
    }));
  }
  return AVAILABLE_MODELS.map((model) => ({
    key: model.slug,
    title: model.title,
    detail: `${model.category} · ${model.difficulty} · ${model.estimatedMinutes} min`,
  }));
}

export function projectWorkspacePath(projectType: ProfessorProjectType, key: string) {
  if (projectType === "mechanism_arena") return `/mechanism-arena/${key}`;
  if (projectType === "evidence_lab") return `/research/${key}`;
  if (projectType === "econbench") return `/econbench/${key.toLowerCase()}`;
  return `/models/${key}`;
}
