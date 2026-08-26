import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CURRICULUM_SYSTEM_LABELS, CURRICULUM_SYSTEMS, isCurriculumSystem } from "@/lib/league/curriculum";

const migration = readFileSync("supabase/migrations/20260817000000_school_curriculum_systems.sql", "utf8");
const joinPage = readFileSync("components/league/join-league.tsx", "utf8");
const onboarding = readFileSync("components/auth/account-onboarding.tsx", "utf8");
const updatePage = readFileSync("components/league/school-curriculum.tsx", "utf8");

describe("school curriculum systems", () => {
  it("keeps the four approved curriculum choices explicit and validated", () => {
    expect(CURRICULUM_SYSTEMS).toEqual(["ap", "ib", "alevel", "other"]);
    expect(CURRICULUM_SYSTEM_LABELS.alevel).toBe("A-Level");
    expect(isCurriculumSystem("ib")).toBe(true);
    expect(isCurriculumSystem("gcse")).toBe(false);
  });

  it("enforces the choice for future applications in the database", () => {
    expect(migration).toContain("alter column curriculum_system set not null");
    expect(migration).toContain("check (curriculum_system in ('ap', 'ib', 'alevel', 'other'))");
    expect(migration).toContain("application.curriculum_system");
    expect(migration).toContain("p_curriculum_system text default null");
  });

  it("limits existing-school updates to the registered School Leader", () => {
    expect(migration).toContain("update_league_school_curriculum");
    expect(migration).toContain("public.is_school_leader_for(p_school_id, auth.uid())");
    expect(updatePage).toContain("platform_role === \"school_leader\"");
    expect(updatePage).toContain("context.school.id");
  });

  it("requires a curriculum in both school-creation interfaces", () => {
    expect(joinPage).toContain("curriculum_system: \"\" as \"\" | CurriculumSystem");
    expect(joinPage).toContain("<select required value={form.curriculum_system}");
    expect(onboarding).toContain("const [curriculumSystem, setCurriculumSystem]");
    expect(onboarding).toContain("!curriculumSystem || !isCompleteSchoolLocation(schoolLocation) || busy");
  });
});
