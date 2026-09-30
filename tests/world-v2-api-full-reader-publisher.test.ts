import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
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
const PART_COUNTS = new Map([
  ["deposits.json", 2],
  ["domestic-access.json", 4],
  ["facilities.json", 13],
  ["facility-map-links.json", 3],
  ["geography.json", 57],
  ["nodes.json", 2],
  ["production-plans.json", 2],
  ["regions.json", 5],
  ["stocks.json", 3],
  ["trade-plans.json", 4],
  ["transport-routes.json", 24],
]);

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function storageExpectation() {
  const sources = [];
  const rows = [];
  for (const root of FULL_JSON_ARTIFACT_PATHS) {
    const sourcePath = Buffer.from(root.slice(7), "hex").toString("utf8");
    const filename = sourcePath.slice("data/".length);
    const partCount = PART_COUNTS.get(filename) ?? 1;
    const partBytes = partCount === 1 ? 100 : 100_000;
    sources.push({
      artifact_path: root,
      content_sha256:
        partCount === 1
          ? sha256(`${sourcePath}:1`)
          : sha256(`full:${sourcePath}`),
      content_bytes: partCount * partBytes,
    });
    for (let index = 1; index <= partCount; index += 1) {
      rows.push({
        bundle_id: BUNDLE_ID,
        artifact_path:
          partCount === 1
            ? root
            : `${root}.part${String(index).padStart(4, "0")}`,
        content_sha256: sha256(`${sourcePath}:${index}`),
        content_bytes: partBytes,
      });
    }
  }
  rows.sort((left, right) =>
    left.artifact_path.localeCompare(right.artifact_path),
  );
  return {
    candidate_bundle: {
      bundle_id: BUNDLE_ID,
      source_thread_id: "fixture-source-thread",
      package_manifest_sha256: sha256("fixture-manifest"),
      source_status: "IMPLEMENTED_UNVERIFIED_CANDIDATE",
      activation_allowed: false,
    },
    full_json_source_digests: sources,
    full_json_storage_rows: rows,
  };
}

const STORAGE = storageExpectation();

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
          candidate_bundle: structuredClone(STORAGE.candidate_bundle),
          full_json_source_digests: structuredClone(
            STORAGE.full_json_source_digests,
          ),
          full_json_storage_rows: STORAGE.full_json_storage_rows.map((row) => ({
            ...row,
            computed_sha256: row.content_sha256,
          })),
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
    expect(renderer).toContain(
      "left(artifact.artifact_path, length(source.artifact_path) + 5)",
    );
    expect(verifier).toContain("WORLD_V2_FULL_READER_EVIDENCE_MISMATCH");
    expect(verifier).toContain("full_json_storage_rows");
  });

  it("accepts the 23 root and 119 chunk rows with exact ledger, ACL, and policy evidence", () => {
    expect(STORAGE.full_json_storage_rows).toHaveLength(142);
    expect(
      STORAGE.full_json_storage_rows.filter((row) =>
        row.artifact_path.includes(".part"),
      ),
    ).toHaveLength(119);
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
          ...STORAGE,
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

      const geographyRoot = `source/${Buffer.from(
        "data/geography.json",
        "utf8",
      ).toString("hex")}`;
      const storageCases: Array<{
        name: string;
        mutate: (value: ReturnType<typeof evidence>) => void;
      }> = [
        {
          name: "missing part",
          mutate: (value) => {
            const rows = value.rows[0].evidence.full_json_storage_rows;
            rows.splice(
              rows.findIndex(
                (row) => row.artifact_path === `${geographyRoot}.part0002`,
              ),
              1,
            );
          },
        },
        {
          name: "duplicate part",
          mutate: (value) => {
            const rows = value.rows[0].evidence.full_json_storage_rows;
            const part = rows.find(
              (row) => row.artifact_path === `${geographyRoot}.part0002`,
            );
            if (!part) throw new Error("missing part fixture");
            part.artifact_path = `${geographyRoot}.part0001`;
          },
        },
        {
          name: "out-of-order part",
          mutate: (value) => {
            value.rows[0].evidence.full_json_storage_rows.reverse();
          },
        },
        {
          name: "extra part",
          mutate: (value) => {
            const rows = value.rows[0].evidence.full_json_storage_rows;
            const part = rows.find(
              (row) => row.artifact_path === `${geographyRoot}.part0057`,
            );
            if (!part) throw new Error("missing part fixture");
            rows.push({ ...part, artifact_path: `${geographyRoot}.part0058` });
            rows.sort((left, right) =>
              left.artifact_path.localeCompare(right.artifact_path),
            );
          },
        },
        {
          name: "malformed extra part number",
          mutate: (value) => {
            const rows = value.rows[0].evidence.full_json_storage_rows;
            const part = rows.find(
              (row) => row.artifact_path === `${geographyRoot}.part0057`,
            );
            if (!part) throw new Error("missing part fixture");
            rows.push({ ...part, artifact_path: `${geographyRoot}.part10000` });
            rows.sort((left, right) =>
              left.artifact_path.localeCompare(right.artifact_path),
            );
          },
        },
        {
          name: "wrong bundle",
          mutate: (value) => {
            value.rows[0].evidence.full_json_storage_rows[0]!.bundle_id =
              "OTHER_BUNDLE";
          },
        },
        {
          name: "wrong stored hash",
          mutate: (value) => {
            value.rows[0].evidence.full_json_storage_rows[0]!.content_sha256 =
              sha256("wrong");
          },
        },
        {
          name: "wrong reconstructed hash",
          mutate: (value) => {
            value.rows[0].evidence.full_json_source_digests[0]!.content_sha256 =
              sha256("wrong");
          },
        },
        {
          name: "root and parts together",
          mutate: (value) => {
            const rows = value.rows[0].evidence.full_json_storage_rows;
            const part = rows.find(
              (row) => row.artifact_path === `${geographyRoot}.part0001`,
            );
            if (!part) throw new Error("missing part fixture");
            rows.push({ ...part, artifact_path: geographyRoot });
            rows.sort((left, right) =>
              left.artifact_path.localeCompare(right.artifact_path),
            );
          },
        },
        {
          name: "wrong bundle metadata",
          mutate: (value) => {
            value.rows[0].evidence.candidate_bundle.bundle_id = "OTHER_BUNDLE";
          },
        },
        {
          name: "wrong UTF-8 byte count",
          mutate: (value) => {
            value.rows[0].evidence.full_json_storage_rows[0]!.content_bytes += 1;
          },
        },
      ];
      for (const testCase of storageCases) {
        const invalidStorage = evidence(
          "AFTER_FULL_READER_RELEASE",
          afterLedger,
          true,
        );
        testCase.mutate(invalidStorage);
        writeFileSync(afterPath, JSON.stringify(invalidStorage));
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
          testCase.name,
        ).not.toBe(0);
      }

      const invalidChunkGrouping = evidence(
        "AFTER_FULL_READER_RELEASE",
        afterLedger,
        true,
      );
      const fullReaderPolicy =
        invalidChunkGrouping.rows[0].evidence.candidate_table_policies.find(
          (policy) =>
            policy.name ===
            "country_candidate_artifact_selected_full_source_server_read",
        );
      if (!fullReaderPolicy) {
        throw new Error("missing full-reader policy test fixture");
      }
      fullReaderPolicy.qual = fullReaderPolicy.qual.replace(
        FULL_READER_CHUNK_PATTERN,
        `^${FULL_JSON_ARTIFACT_PATHS.join("|")}\\.part[0-9]{4}$`,
      );
      writeFileSync(afterPath, JSON.stringify(invalidChunkGrouping));
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

      const invalidLiteralCast = evidence(
        "AFTER_FULL_READER_RELEASE",
        afterLedger,
        true,
      );
      const literalCastFullReaderPolicy =
        invalidLiteralCast.rows[0].evidence.candidate_table_policies.find(
          (policy) =>
            policy.name ===
            "country_candidate_artifact_selected_full_source_server_read",
        );
      if (!literalCastFullReaderPolicy) {
        throw new Error("missing full-reader policy test fixture");
      }
      literalCastFullReaderPolicy.qual =
        literalCastFullReaderPolicy.qual.replace(
          FULL_READER_CHUNK_PATTERN,
          `${FULL_READER_CHUNK_PATTERN}::text`,
        );
      writeFileSync(afterPath, JSON.stringify(invalidLiteralCast));
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

      const invalidBooleanGrouping = evidence(
        "AFTER_FULL_READER_RELEASE",
        afterLedger,
        true,
      );
      const misgroupedFullReaderPolicy =
        invalidBooleanGrouping.rows[0].evidence.candidate_table_policies.find(
          (policy) =>
            policy.name ===
            "country_candidate_artifact_selected_full_source_server_read",
        );
      if (!misgroupedFullReaderPolicy) {
        throw new Error("missing full-reader policy test fixture");
      }
      misgroupedFullReaderPolicy.qual = `(((bundle_id = '${BUNDLE_ID}'::text) AND (artifact_path = ANY (ARRAY[${FULL_JSON_ARTIFACT_PATHS.map(
        (artifactPath) => `'${artifactPath}'::text`,
      ).join(
        ", ",
      )}]))) OR (artifact_path ~ '${FULL_READER_CHUNK_PATTERN}'::text))`;
      writeFileSync(afterPath, JSON.stringify(invalidBooleanGrouping));
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

      const invalidAfter = evidence(
        "AFTER_FULL_READER_RELEASE",
        afterLedger,
        true,
      );
      invalidAfter.rows[0].evidence.full_json_storage_rows.push({
        ...invalidAfter.rows[0].evidence.full_json_storage_rows[0],
        artifact_path: "source/not-reviewed.json",
      });
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
  }, 30_000);
});
