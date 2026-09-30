import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

const verifier = readFileSync(
  "scripts/verify-world-v2-api-reader-release.mjs",
  "utf8",
);
const workflow = readFileSync(
  ".github/workflows/release-world-v2-api-reader.yml",
  "utf8",
);
const unknownOutcomeWriter = readFileSync(
  "scripts/write-world-v2-release-unknown.mjs",
  "utf8",
);

function response() {
  return {
    rows: [
      {
        evidence: {
          phase: "SCHEMA",
          migration_id: "0020_world_v2_official_country_reader",
          artifact_sha256:
            "083e06aca86763e4bc32a34347c1a86b26aa910f3c6a191b9393021347211618",
          source_repo_commit: "f3413bae195b75e80d28d6afa314ca0e394bdfbc",
          release_order: 20,
          reader_role: {
            can_login: false,
            can_bypass_rls: false,
            is_superuser: false,
            inherits_privileges: false,
          },
          login_role: {
            can_login: false,
            can_bypass_rls: false,
            is_superuser: false,
            inherits_privileges: false,
          },
          login_may_set_reader_role: true,
          selected_source_policy_count: 2,
        },
      },
    ],
  };
}

describe("World V2 selected-country API reader publisher", () => {
  it("uses one confirmed, fixed-target, fail-closed Management API request", () => {
    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).toContain("group: supabase-production");
    expect(workflow).toContain(
      'test "$CONFIRMATION" = "RELEASE_WORLD_V2_API_READER"',
    );
    expect(workflow).toContain(
      'test "$SUPABASE_PROJECT_REF" = "vimksjrhaxdpnkvgsavz"',
    );
    expect(workflow).toContain("41fedbb0cbd64b7dca510aa1daddaeab5571cef6");
    expect(workflow.match(/database\/query/g)).toHaveLength(1);
    expect(workflow).toContain("write-world-v2-release-unknown.mjs");
    expect(unknownOutcomeWriter).toContain("WORLD_V2_RELEASE_UNKNOWN");
    expect(workflow).not.toContain("SUPABASE_DB_PASSWORD");
    expect(workflow).not.toContain("supabase db push");
    expect(workflow).not.toContain("supabase link");

    expect(verifier).toContain("WORLD_V2_API_READER_EVIDENCE_MISMATCH");
    expect(verifier).toContain("selected_source_policy_count");
    expect(verifier).toContain("SERVER_ONLY_INACTIVE_CANDIDATE_READ");
  });

  it("accepts only the exact least-privilege response evidence", () => {
    const outputRoot = mkdtempSync(path.join(tmpdir(), "world-v2-api-reader-"));
    const responsePath = path.join(outputRoot, "response.json");
    const outputPath = path.join(outputRoot, "evidence.json");
    try {
      writeFileSync(responsePath, JSON.stringify(response()));
      expect(
        execFileSync(process.execPath, [
          "scripts/verify-world-v2-api-reader-release.mjs",
          responsePath,
          outputPath,
        ]),
      ).toBeDefined();
      expect(JSON.parse(readFileSync(outputPath, "utf8"))).toMatchObject({
        status: "WORLD_V2_API_READER_RELEASE_VERIFIED",
        authority: "SERVER_ONLY_INACTIVE_CANDIDATE_READ",
      });

      const invalid = response();
      invalid.rows[0].evidence.reader_role.can_bypass_rls = true;
      writeFileSync(responsePath, JSON.stringify(invalid));
      expect(
        spawnSync(
          process.execPath,
          [
            "scripts/verify-world-v2-api-reader-release.mjs",
            responsePath,
            outputPath,
          ],
          { stdio: "pipe" },
        ).status,
      ).not.toBe(0);
    } finally {
      rmSync(outputRoot, { force: true, recursive: true });
    }
  });
});
