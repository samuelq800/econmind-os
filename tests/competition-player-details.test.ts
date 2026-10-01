import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync("supabase/migrations/20261001000000_competition_player_details.sql", "utf8");
const app = readFileSync("components/competition/competition-app.tsx", "utf8");

describe("NEC / IEO player profile details", () => {
  it("keeps the detailed query in the viewer's division and preserves academic visibility", () => {
    expect(migration).toContain("public.require_member_profile_user()");
    expect(migration).toContain("m.competition = p_competition");
    expect(migration).toContain("m.division = p_division");
    expect(migration).toContain("m.status = 'looking_for_team'");
    expect(migration).toContain("public.competition_blocks");
    expect(migration).toContain("public.visible_competition_academic(p_target, v_viewer, v_viewer_team)");
    expect(migration).toContain("case when v_school_visible then v_academic.location else null end");
    expect(migration).toContain("case when v_gpa_visible then v_academic.gpa_system else null end");
    expect(migration).toContain("from public, anon, authenticated");
    expect(migration).toContain("to authenticated;");
  });

  it("shows all academic categories and matching information in the player drawer", () => {
    for (const label of [
      "School location", "Current grade", "Expected graduation", "Curriculum", "GPA system",
      "Economics", "IELTS / TOEFL", "SAT / ACT", "AMC", "Competition history",
      "Strengths", "Looking for", "Preferred teammate profile",
    ]) expect(app).toContain(label);
    expect(app).toContain("getCompetitionPlayerDetail(chosenPlayerId, activeCompetition, activeDivision)");
    expect(app).toContain("Not provided or not shared");
    expect(app).not.toContain("JSON.stringify(record)");
  });
});
