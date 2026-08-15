import type { ProfessorProjectType } from "@/lib/professor-studio/catalog";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export type ProfessorProjectStatus = "draft" | "published" | "closed" | "archived";
export type ProfessorProjectScope = "open" | "invited";
export type OfficialReviewStatus = "not_requested" | "pending" | "approved" | "rejected";

export type ProfessorProject = {
  id: string;
  professor_id: string;
  project_type: ProfessorProjectType;
  title: string;
  summary: string;
  brief: string;
  source_key: string;
  participation_scope: ProfessorProjectScope;
  status: ProfessorProjectStatus;
  official_review_status: OfficialReviewStatus;
  configuration: Record<string, unknown>;
  published_at: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ProfessorProjectAudience = {
  audienceType: "school" | "team" | "account";
  targetId: string;
};

function client() {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error("Supabase is not configured.");
  return supabase;
}

function fail(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

export async function listMyProfessorProjects() {
  const { data, error } = await client().rpc("list_my_professor_projects");
  fail(error);
  return (data ?? []) as ProfessorProject[];
}

export async function listAccessibleProfessorProjects() {
  const { data, error } = await client().rpc("list_accessible_professor_projects");
  fail(error);
  return (data ?? []) as ProfessorProject[];
}

export async function saveProfessorProject(input: {
  id?: string;
  projectType: ProfessorProjectType;
  title: string;
  summary: string;
  brief: string;
  sourceKey: string;
  participationScope: ProfessorProjectScope;
  status: ProfessorProjectStatus;
  configuration?: Record<string, unknown>;
  audiences?: ProfessorProjectAudience[];
}) {
  const { data, error } = await client().rpc("save_professor_project", {
    p_project_id: input.id ?? null,
    p_payload: {
      project_type: input.projectType,
      title: input.title,
      summary: input.summary,
      brief: input.brief,
      source_key: input.sourceKey,
      participation_scope: input.participationScope,
      status: input.status,
      configuration: input.configuration ?? { schema_version: 1 },
    },
    p_audiences: (input.audiences ?? []).map((audience) => ({
      audience_type: audience.audienceType,
      target_id: audience.targetId,
    })),
  });
  fail(error);
  return data as ProfessorProject;
}

export async function requestProfessorProjectOfficialReview(projectId: string) {
  const { error } = await client().rpc("request_professor_project_official_review", { p_project_id: projectId });
  fail(error);
}
