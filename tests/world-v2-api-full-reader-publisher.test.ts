import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

const renderer = readFileSync(
  "scripts/render-world-v2-api-full-reader-release.mjs",
  "utf8",
);
const verifier = readFileSync(
  "scripts/verify-world-v2-api-full-reader-release.mjs",
  "utf8",
);
const workflow = readFileSync(
  ".github/workflows/release-world-v2-api-full-reader.yml",
  "utf8",
);

const READER_ROLE = "world_v2_api_reader";
const BUNDLE_ID = "BALANCED_2026_09_28_V1";
const MIGRATION_ID = "0021_world_v2_official_full_data_reader";
const MIGRATION_SHA256 =
  "e5c75c9f731283571680647d0447fd88924bf8a1476f67fe71b7c663ead1f670";
const MIGRATION_SOURCE_COMMIT = "f2ceea4bce70e8d2a193c641f87af5ce8d2e47e3";
const FULL_JSON_ARTIFACT_PATHS = [
  "assumptions.json",
  "changes.json",
  "commodity-catalog.json",
  "countries.json",
  "coverage.json",
  "deposits.json",
  "domestic-access.json",
  "employment.json",
  "entities.json",
  "facilities.json",
  "facility-map-links.json",
  "finance.json",
  "geography.json",
  "hazard-proposals.json",
  "illustration-links.json",
  "land-program.json",
  "license-proposals.json",
  "manifest.json",
  "nodes.json",
  "opening-material-reconciliation.json",
  "population-services.json",
  "power.json",
  "production-plans.json",
  "recipes.json",
  "regions.json",
  "seasonal-water.json",
  "settlements.json",
  "stocks.json",
  "supplier-concentration-policy.json",
  "technology-proposals.json",
  "trade-plans.json",
  "transit-proposals.json",
  "transport-routes.json",
  "water-allocations.json",
]
  .map(
    (file) => `source/${Buffer.from(`data/${file}`, "utf8").toString("hex")}`,
  )
  .sort();
const FULL_READER_CHUNK_PATTERN = `^(${FULL_JSON_ARTIFACT_PATHS.join(
  "|",
)})\\.part[0-9]{4}$`;

function baselineLedger() {
  return Array.from({ length: 20 }, (_, index) => ({
    migration_id: `baseline-${index + 1}`,
    artifact_sha256: String(index + 1).padStart(64, "0"),
    source_repo_commit: String(index + 1).padStart(40, "a"),
    release_order: index + 1,
  }));
}

function policies(includeFullReaderPolicy: boolean) {
  const result = [
    {
      schema: "world_v2",
      table: "country_candidate_artifact",
      name: "country_candidate_artifact_selected_source_server_read",
      roles: [READER_ROLE],
      command: "SELECT",
      permissive: "PERMISSIVE",
      qual: "((bundle_id = 'BALANCED_2026_09_28_V1'::text) AND (artifact_path = 'source/646174612f636f756e74726965732e6a736f6e'::text))",
      with_check: null,
    },
    {
      schema: "world_v2",
      table: "country_candidate_bundle",
      name: "country_candidate_bundle_selected_source_server_read",
      roles: [READER_ROLE],
      command: "SELECT",
      permissive: "PERMISSIVE",
      qual: "(bundle_id = 'BALANCED_2026_09_28_V1'::text)",
      with_check: null,
    },
  ];
  if (includeFullReaderPolicy) {
    result.push({
      schema: "world_v2",
      table: "country_candidate_artifact",
      name: "country_candidate_artifact_selected_full_source_server_read",
      roles: [READER_ROLE],
      command: "SELECT",
      permissive: "PERMISSIVE",
      qual: `((bundle_id = '${BUNDLE_ID}'::text) AND ((artifact_path = ANY (ARRAY[${FULL_JSON_ARTIFACT_PATHS.map(
        (artifactPath: string) => `'${artifactPath}'::text`,
      ).join(
        ", ",
      )}])) OR (artifact_path ~ '${FULL_READER_CHUNK_PATTERN}'::text)))`,
      with_check: null,
    });
  }
  return result.sort((left, right) => left.name.localeCompare(right.name));
}

function evidence(
  phase: string,
  ledgerEntries: ReturnType<typeof baselineLedger>,
  includeFullReaderPolicy: boolean,
) {
  return {
    rows: [
      {
        evidence: {
          phase,
          ledger_entries: ledgerEntries,
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
              member: "postgres",
              role: READER_ROLE,
              grantor: "supabase_admin",
              admin_option: true,
              inherit_option: false,
              set_option: false,
            },
            {
              member: "world_v2_api_login",
              role: READER_ROLE,
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
          candidate_table_policies: policies(includeFullReaderPolicy),
          full_json_artifact_paths: FULL_JSON_ARTIFACT_PATHS,
        },
      },
    ],
  };
}

describe("World V2 full-data API reader publisher", () => {
  it("uses a fixed World source and exactly one atomic 0021 request", () => {
    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).toContain("group: supabase-production");
    expect(workflow).toContain(
      'test "$CONFIRMATION" = "RELEASE_WORLD_V2_API_FULL_READER"',
    );
    expect(workflow).toContain(
      'test "$SUPABASE_PROJECT_REF" = "vimksjrhaxdpnkvgsavz"',
    );
    expect(workflow).toContain("ede72d1adc97272c56ec0733227d72c2b8e89207");
    expect(workflow).toContain(
      "Execute exactly one atomic 0021 management API request",
    );
    expect(workflow.match(/database\/query/g)).toHaveLength(3);
    expect(workflow).toContain(
      "Verify exact 0020 baseline before the write request",
    );
    expect(workflow).toContain("steps.preflight_evidence.outcome == 'success'");
    expect(workflow).toContain("write-world-v2-release-unknown.mjs");
    expect(workflow).toContain("read-only-diagnostic-response.json");
    expect(workflow).not.toContain("SUPABASE_DB_PASSWORD");
    expect(workflow).not.toContain("supabase db push");
    expect(workflow).not.toContain("supabase link");

    expect(renderer).toContain(MIGRATION_ID);
    expect(renderer).toContain(MIGRATION_SHA256);
    expect(renderer).toContain(MIGRATION_SOURCE_COMMIT);
    expect(renderer).toContain("PREVIOUS_MIGRATION_COUNT = 20");
    expect(verifier).toContain("WORLD_V2_FULL_READER_EVIDENCE_MISMATCH");
    expect(verifier).toContain("full_json_artifact_paths");
  });

  it("accepts only exact before-and-after ledger, ACL, policy, and root evidence", () => {
    const outputRoot = mkdtempSync(
      path.join(tmpdir(), "world-v2-api-full-reader-"),
    );
    const beforePath = path.join(outputRoot, "before.json");
    const afterPath = path.join(outputRoot, "after.json");
    const expectationPath = path.join(outputRoot, "expectation.json");
    const outputPath = path.join(outputRoot, "evidence.json");
    const preconditionPath = path.join(outputRoot, "precondition.json");
    try {
      const beforeLedger = baselineLedger();
      const afterLedger = [
        ...beforeLedger,
        {
          migration_id: MIGRATION_ID,
          artifact_sha256: MIGRATION_SHA256,
          source_repo_commit: MIGRATION_SOURCE_COMMIT,
          release_order: 21,
        },
      ];
      writeFileSync(
        beforePath,
        JSON.stringify(
          evidence("BEFORE_FULL_READER_RELEASE", beforeLedger, false),
        ),
      );
      writeFileSync(
        afterPath,
        JSON.stringify(
          evidence("AFTER_FULL_READER_RELEASE", afterLedger, true),
        ),
      );
      writeFileSync(
        expectationPath,
        JSON.stringify({
          before_ledger: beforeLedger,
          after_ledger: afterLedger,
          full_json_artifact_paths: FULL_JSON_ARTIFACT_PATHS,
          migration_id: MIGRATION_ID,
          migration_sha256: MIGRATION_SHA256,
          migration_source_commit: MIGRATION_SOURCE_COMMIT,
        }),
      );
      expect(
        execFileSync(process.execPath, [
          "scripts/verify-world-v2-api-full-reader-release.mjs",
          "--preflight",
          beforePath,
          expectationPath,
          preconditionPath,
        ]),
      ).toBeDefined();
      expect(JSON.parse(readFileSync(preconditionPath, "utf8"))).toMatchObject({
        status: "WORLD_V2_API_FULL_READER_PRECONDITION_VERIFIED",
      });
      expect(
        execFileSync(process.execPath, [
          "scripts/verify-world-v2-api-full-reader-release.mjs",
          beforePath,
          afterPath,
          expectationPath,
          outputPath,
        ]),
      ).toBeDefined();
      expect(JSON.parse(readFileSync(outputPath, "utf8"))).toMatchObject({
        status: "WORLD_V2_API_FULL_READER_RELEASE_VERIFIED",
        authority: "SERVER_ONLY_INACTIVE_CANDIDATE_FULL_DATA_READ",
      });

      const invalidAfter = evidence(
        "AFTER_FULL_READER_RELEASE",
        afterLedger,
        true,
      );
      invalidAfter.rows[0].evidence.full_json_artifact_paths = [
        ...FULL_JSON_ARTIFACT_PATHS,
        "source/not-reviewed.json",
      ];
      writeFileSync(afterPath, JSON.stringify(invalidAfter));
      expect(
        spawnSync(
          process.execPath,
          [
            "scripts/verify-world-v2-api-full-reader-release.mjs",
            beforePath,
            afterPath,
            expectationPath,
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
