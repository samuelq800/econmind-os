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
          reader_memberships: [
            {
              member: "world_v2_api_login",
              role: "world_v2_api_reader",
              admin_option: false,
              inherit_option: false,
              set_option: true,
            },
          ],
          schema_usage: ["public", "world_v2"],
          column_select_privileges: [
            { table: "country_candidate_artifact", column: "bundle_id" },
            {
              table: "country_candidate_artifact",
              column: "artifact_path",
            },
            {
              table: "country_candidate_artifact",
              column: "content_sha256",
            },
            {
              table: "country_candidate_artifact",
              column: "content_utf8",
            },
            { table: "country_candidate_bundle", column: "bundle_id" },
            {
              table: "country_candidate_bundle",
              column: "package_manifest_sha256",
            },
            {
              table: "country_candidate_bundle",
              column: "source_status",
            },
            {
              table: "country_candidate_bundle",
              column: "activation_allowed",
            },
          ],
          table_select_privileges: [],
          nonselect_table_privileges: [],
          selected_source_policies: [
            {
              schema: "world_v2",
              table: "country_candidate_artifact",
              name: "country_candidate_artifact_selected_source_server_read",
              roles: ["world_v2_api_reader"],
              command: "SELECT",
              permissive: "PERMISSIVE",
              qual: "((bundle_id = 'BALANCED_2026_09_28_V1'::text) AND (artifact_path = 'source/646174612f636f756e74726965732e6a736f6e'::text))",
              with_check: null,
            },
            {
              schema: "world_v2",
              table: "country_candidate_bundle",
              name: "country_candidate_bundle_selected_source_server_read",
              roles: ["world_v2_api_reader"],
              command: "SELECT",
              permissive: "PERMISSIVE",
              qual: "(bundle_id = 'BALANCED_2026_09_28_V1'::text)",
              with_check: null,
            },
          ],
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
    expect(workflow).toContain("0f78abec88018430ec82ec6a647f049a176d6cda");
    expect(workflow.match(/database\/query/g)).toHaveLength(1);
    expect(workflow).toContain("write-world-v2-release-unknown.mjs");
    expect(unknownOutcomeWriter).toContain("WORLD_V2_RELEASE_UNKNOWN");
    expect(workflow).not.toContain("SUPABASE_DB_PASSWORD");
    expect(workflow).not.toContain("supabase db push");
    expect(workflow).not.toContain("supabase link");

    expect(verifier).toContain("WORLD_V2_API_READER_EVIDENCE_MISMATCH");
    expect(verifier).toContain("selected_source_policies");
    expect(verifier).toContain("column_select_privileges");
    expect(verifier).toContain("reader_memberships");
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
      invalid.rows[0].evidence.selected_source_policies[0].table =
        "country_candidate_profile";
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

      const extraColumn = response();
      extraColumn.rows[0].evidence.column_select_privileges.push({
        table: "country_candidate_bundle",
        column: "source_thread_id",
      });
      writeFileSync(responsePath, JSON.stringify(extraColumn));
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

      const missingSetOption = response();
      missingSetOption.rows[0].evidence.reader_memberships[0].set_option = false;
      writeFileSync(responsePath, JSON.stringify(missingSetOption));
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
