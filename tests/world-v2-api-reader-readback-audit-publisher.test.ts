import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

const verifier = readFileSync(
  "scripts/verify-world-v2-api-reader-readback-audit.mjs",
  "utf8",
);
const workflow = readFileSync(
  ".github/workflows/audit-world-v2-api-reader-readback.yml",
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
          phase: "READBACK_AUDIT",
          ledger_entries: [
            {
              migration_id: "0020_world_v2_official_country_reader",
              artifact_sha256:
                "083e06aca86763e4bc32a34347c1a86b26aa910f3c6a191b9393021347211618",
              source_repo_commit: "f3413bae195b75e80d28d6afa314ca0e394bdfbc",
              release_order: 20,
            },
          ],
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
          control_plane_role: {
            name: "postgres",
            can_login: true,
            can_bypass_rls: true,
            is_superuser: false,
            can_create_role: true,
            inherits_privileges: true,
          },
          reader_memberships: [
            {
              member: "postgres",
              role: "world_v2_api_reader",
              grantor: "supabase_admin",
              admin_option: true,
              inherit_option: false,
              set_option: false,
            },
            {
              member: "world_v2_api_login",
              role: "world_v2_api_reader",
              grantor: "postgres",
              admin_option: false,
              inherit_option: false,
              set_option: true,
            },
          ],
          schema_usage: ["public", "world_v2"],
          column_select_privileges: [
            {
              schema: "world_v2",
              table: "country_candidate_artifact",
              column: "bundle_id",
            },
            {
              schema: "world_v2",
              table: "country_candidate_artifact",
              column: "artifact_path",
            },
            {
              schema: "world_v2",
              table: "country_candidate_artifact",
              column: "content_sha256",
            },
            {
              schema: "world_v2",
              table: "country_candidate_artifact",
              column: "content_utf8",
            },
            {
              schema: "world_v2",
              table: "country_candidate_bundle",
              column: "bundle_id",
            },
            {
              schema: "world_v2",
              table: "country_candidate_bundle",
              column: "package_manifest_sha256",
            },
            {
              schema: "world_v2",
              table: "country_candidate_bundle",
              column: "source_status",
            },
            {
              schema: "world_v2",
              table: "country_candidate_bundle",
              column: "activation_allowed",
            },
          ],
          table_privileges: [],
          candidate_table_policies: [
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

function jsonbSerializedResponse() {
  const reorder = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(reorder);
    if (value === null || typeof value !== "object") return value;
    return Object.fromEntries(
      Object.entries(value)
        .reverse()
        .map(([key, child]) => [key, reorder(child)]),
    );
  };
  return reorder(response());
}

function verifies(responseBody: unknown, outputRoot: string) {
  const responsePath = path.join(outputRoot, "response.json");
  const outputPath = path.join(outputRoot, "evidence.json");
  writeFileSync(responsePath, JSON.stringify(responseBody));
  return spawnSync(
    process.execPath,
    [
      "scripts/verify-world-v2-api-reader-readback-audit.mjs",
      responsePath,
      outputPath,
    ],
    { stdio: "pipe" },
  );
}

describe("World V2 reader readback audit publisher", () => {
  it("uses one fixed-target, read-only, fail-closed Management API request", () => {
    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).toContain("group: supabase-production");
    expect(workflow).toContain(
      'test "$CONFIRMATION" = "AUDIT_WORLD_V2_API_READER_READBACK"',
    );
    expect(workflow).toContain(
      'test "$SUPABASE_PROJECT_REF" = "vimksjrhaxdpnkvgsavz"',
    );
    expect(workflow).toContain("d3884d81435816cedd6f8a0a46510dfd49c1ba5e");
    expect(workflow.match(/database\/query/g)).toHaveLength(1);
    expect(workflow).toContain("verify-world-v2-api-reader-readback-audit.mjs");
    expect(workflow).toContain("write-world-v2-release-unknown.mjs");
    expect(unknownOutcomeWriter).toContain("WORLD_V2_RELEASE_UNKNOWN");
    expect(workflow).not.toContain("SUPABASE_DB_PASSWORD");
    expect(workflow).not.toContain("supabase db push");
    expect(workflow).not.toContain("supabase link");
    expect(workflow).not.toContain("render-world-v2-api-reader-release.mjs");

    expect(verifier).toContain("WORLD_V2_API_READER_AUDIT_EVIDENCE_MISMATCH");
    expect(verifier).toContain("control_plane_role");
    expect(verifier).toContain("reader_memberships");
    expect(verifier).toContain("candidate_table_policies");
    expect(verifier).toContain("SERVER_ONLY_INACTIVE_CANDIDATE_READ");
  });

  it("accepts only the exact read-only production audit evidence", () => {
    const outputRoot = mkdtempSync(
      path.join(tmpdir(), "world-v2-api-reader-audit-"),
    );
    const responsePath = path.join(outputRoot, "response.json");
    const outputPath = path.join(outputRoot, "evidence.json");
    try {
      writeFileSync(responsePath, JSON.stringify(response()));
      expect(
        execFileSync(process.execPath, [
          "scripts/verify-world-v2-api-reader-readback-audit.mjs",
          responsePath,
          outputPath,
        ]),
      ).toBeDefined();
      expect(JSON.parse(readFileSync(outputPath, "utf8"))).toMatchObject({
        status: "WORLD_V2_API_READER_READBACK_AUDIT_VERIFIED",
        authority: "SERVER_ONLY_INACTIVE_CANDIDATE_READ",
      });

      expect(verifies(jsonbSerializedResponse(), outputRoot).status).toBe(0);

      const missingLedger = response();
      missingLedger.rows[0].evidence.ledger_entries = [];
      expect(verifies(missingLedger, outputRoot).status).not.toBe(0);

      const wrongLedger = response();
      wrongLedger.rows[0].evidence.ledger_entries[0].artifact_sha256 =
        "0000000000000000000000000000000000000000000000000000000000000000";
      expect(verifies(wrongLedger, outputRoot).status).not.toBe(0);

      const wrongSourceLedger = response();
      wrongSourceLedger.rows[0].evidence.ledger_entries[0].source_repo_commit =
        "0000000000000000000000000000000000000000";
      expect(verifies(wrongSourceLedger, outputRoot).status).not.toBe(0);

      const wrongOrderLedger = response();
      wrongOrderLedger.rows[0].evidence.ledger_entries[0].release_order = 21;
      expect(verifies(wrongOrderLedger, outputRoot).status).not.toBe(0);

      const duplicateLedger = response();
      duplicateLedger.rows[0].evidence.ledger_entries.push({
        ...duplicateLedger.rows[0].evidence.ledger_entries[0],
      });
      expect(verifies(duplicateLedger, outputRoot).status).not.toBe(0);

      const thirdMembership = response();
      thirdMembership.rows[0].evidence.reader_memberships.push({
        member: "unexpected_login",
        role: "world_v2_api_reader",
        grantor: "postgres",
        admin_option: false,
        inherit_option: false,
        set_option: true,
      });
      expect(verifies(thirdMembership, outputRoot).status).not.toBe(0);

      const changedGrantor = response();
      changedGrantor.rows[0].evidence.reader_memberships[0].grantor =
        "postgres";
      expect(verifies(changedGrantor, outputRoot).status).not.toBe(0);

      const changedOption = response();
      changedOption.rows[0].evidence.reader_memberships[1].set_option = false;
      expect(verifies(changedOption, outputRoot).status).not.toBe(0);

      const extraColumn = response();
      extraColumn.rows[0].evidence.column_select_privileges.push({
        schema: "world_v2",
        table: "country_candidate_bundle",
        column: "source_thread_id",
      });
      expect(verifies(extraColumn, outputRoot).status).not.toBe(0);

      const extraPolicy = response();
      extraPolicy.rows[0].evidence.candidate_table_policies.push({
        schema: "world_v2",
        table: "country_candidate_artifact",
        name: "country_candidate_artifact_unexpected_reader_scope",
        roles: ["world_v2_api_reader"],
        command: "SELECT",
        permissive: "PERMISSIVE",
        qual: "true",
        with_check: null,
      });
      expect(verifies(extraPolicy, outputRoot).status).not.toBe(0);
    } finally {
      rmSync(outputRoot, { force: true, recursive: true });
    }
  });
});
