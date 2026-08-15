import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { isAcademicAuthor } from "@/lib/experiments/types";
import { PROFESSOR_PROJECT_TYPES, professorProjectTemplates } from "@/lib/professor-studio/catalog";

const migration = readFileSync(
  "supabase/migrations/20260815000000_professor_studio.sql",
  "utf8",
);
const studio = readFileSync(
  "components/professor/professor-studio.tsx",
  "utf8",
);
const auth = readFileSync("components/auth/auth-provider.tsx", "utf8");

describe("Professor Studio", () => {
  it("recognises Professor as an independent academic author", () => {
    expect(isAcademicAuthor("professor")).toBe(true);
    expect(isAcademicAuthor("teacher")).toBe(true);
    expect(isAcademicAuthor("student")).toBe(false);
    expect(migration).toContain("role in ('student', 'teacher', 'professor')");
    expect(migration).toContain("Professor never joins a school or Team");
    expect(migration).toContain("Professor deliberately has no entry in profile_platform_roles");
    expect(migration).toContain("Daily Brief curation remains a teaching-staff responsibility");
    expect(migration).toContain("can_curate_daily_brief");
    expect(auth).toContain('data?.role === "teacher" || data?.role === "professor"');
  });

  it("stores Professor work as academic projects with RLS and an official-review boundary", () => {
    for (const fragment of [
      "create table public.professor_projects",
      "create table public.professor_project_audiences",
      "alter table public.professor_projects enable row level security",
      "save_professor_project",
      "list_accessible_professor_projects",
      "can_access_professor_project",
      "request_professor_project_official_review",
      "review_professor_project",
      "set_econmind_academic_role",
      "Professor role required",
    ]) expect(migration).toContain(fragment);
  });

  it("offers a project composer for all four academic systems from reviewed sources", () => {
    expect(PROFESSOR_PROJECT_TYPES.map((type) => type.key)).toEqual([
      "mechanism_arena",
      "evidence_lab",
      "econbench",
      "model_assignment",
    ]);
    for (const type of PROFESSOR_PROJECT_TYPES) {
      expect(professorProjectTemplates(type.key).length).toBeGreaterThan(0);
    }
    expect(studio).toContain("PROFESSOR_PROJECT_TYPES.map");
    expect(studio).toContain("A live project is not automatically an Official Challenge.");
    expect(studio).toContain("No school administration · no World controls");
    expect(studio).toContain("evidence_upload: false");
  });
});
