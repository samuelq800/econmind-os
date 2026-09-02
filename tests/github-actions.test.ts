import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const readWorkflow = (name: string) =>
  readFileSync(`.github/workflows/${name}`, "utf8");

const ci = readWorkflow("ci.yml");
const pages = readWorkflow("deploy-pages.yml");
const backend = readWorkflow("deploy-supabase.yml");
const maintenance = [
  readWorkflow("apply-account-suspension-migration.yml"),
  readWorkflow("apply-daily-brief-source-policy.yml"),
  readWorkflow("apply-live-world-migration.yml"),
];
const dailyBriefMaintenance = maintenance[1];

describe("GitHub Actions boundaries", () => {
  it("verifies pull requests without production credentials", () => {
    expect(ci).toContain("pull_request:");
    expect(ci).toContain("pnpm typecheck");
    expect(ci).toContain("pnpm lint");
    expect(ci).toContain("pnpm test");
    expect(ci).toContain("pnpm build");
    expect(ci).not.toContain("SUPABASE_ACCESS_TOKEN");
  });

  it("keeps website deployment automatic and schema-gated", () => {
    expect(pages).toContain("branches: [main]");
    expect(pages).toContain("get_public_league_directory_v2");
    expect(pages).toContain("select=account_status");
    expect(pages).toContain("actions/deploy-pages@v4");
  });

  it("serializes every workflow that can change Supabase", () => {
    for (const workflow of [backend, ...maintenance]) {
      expect(workflow).toContain("group: supabase-production");
      expect(workflow).toContain("cancel-in-progress: false");
    }
  });

  it("links the database only for migration operations", () => {
    expect(backend).toMatch(
      /Verify database credential[\s\S]*?if:.*inputs\.apply_migrations/,
    );
    expect(backend).toMatch(
      /Link target project[\s\S]*?if:.*inputs\.apply_migrations/,
    );
    expect(backend).toContain("Preview pending migrations");
  });

  it("keeps maintenance manual and SQL versioned in migrations", () => {
    for (const workflow of maintenance) {
      expect(workflow).toContain("workflow_dispatch:");
      expect(workflow).not.toMatch(/^\s+push:/m);
    }
    expect(dailyBriefMaintenance).toContain(
      "20260831000000_remove_gov_uk_daily_brief_sources.sql",
    );
    expect(dailyBriefMaintenance).not.toContain(
      "delete from public.daily_brief_sources",
    );
  });
});
