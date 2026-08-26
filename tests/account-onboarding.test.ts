import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync("supabase/migrations/20260730020000_account_onboarding_and_school_choice.sql", "utf8");
const component = readFileSync("components/auth/account-onboarding.tsx", "utf8");

describe("first-session school path", () => {
  it("keeps the three explicit choices and requires teacher approval for a new school", () => {
    expect(component).toContain("Choose an existing school");
    expect(component).toContain("Create a school");
    expect(component).toContain("Continue as a visitor");
    expect(component).toContain("does not grant a League role");
  });

  it("exposes only approved schools and completes the choice through a secured RPC", () => {
    expect(migration).toContain("where s.status = 'approved'");
    expect(migration).toContain("security definer");
    expect(migration).toContain("complete_econmind_onboarding");
    expect(migration).toContain("grant execute on function public.complete_econmind_onboarding");
  });

  it("requires a structured city-level location when a new school is submitted", () => {
    expect(component).toContain("SchoolLocationFields");
    expect(component).toContain("isCompleteSchoolLocation(schoolLocation)");
    expect(component).toContain('location: path === "create_school" ? schoolLocation : undefined');
  });

  it("remembers a completed choice per account so refresh does not reopen setup", () => {
    expect(component).toContain("econmind.account-onboarding.completed.");
    expect(component).toContain("localStorage");
    expect(component).toContain("saveOnboardingChoice(userId)");
    expect(component).toContain("if (authOpen || viewerAccess || !user");
  });
});
