import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

const publisher = readFileSync(
  "scripts/render-world-v2-release-query.mjs",
  "utf8",
);
const verifier = readFileSync(
  "scripts/verify-world-v2-release-evidence.mjs",
  "utf8",
);
const workflow = readFileSync(
  ".github/workflows/release-world-v2-schema.yml",
  "utf8",
);
const nativeVerification = readFileSync(
  ".github/workflows/verify-world-v2-release-runner.yml",
  "utf8",
);

describe("World V2 isolated release publisher", () => {
  it("pins the reviewed source, preserves the single-request boundary, and never uses a database password", () => {
    expect(publisher).toContain("02f59be5026cdf2131eaf6e7fd907d5b87e987b3");
    expect(publisher).toContain("loadWorldV2ReleaseHandoff");
    expect(publisher).toContain("--porcelain=v1");
    expect(publisher).toContain("WORLD_V2_NAMESPACE_MUST_BE_ABSENT");
    expect(publisher).toContain("WORLD_V2_SCHEMA_RELEASE_LEDGER_MISMATCH");
    expect(publisher).toContain("WORLD_V2_SCHEMA_TABLE_COUNT_MISMATCH");
    expect(publisher).toContain("WORLD_V2_PROTECTED_CATALOG_CHANGED");
    expect(publisher).toContain("on commit drop");
    expect(verifier).toContain("WORLD_V2_RELEASE_EVIDENCE_MISMATCH");

    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).toContain("group: supabase-production");
    expect(workflow).toContain('test "$RELEASE_CONFIRMATION" = "RELEASE_WORLD_V2"');
    expect(workflow).toContain('test "$SUPABASE_PROJECT_REF" = "vimksjrhaxdpnkvgsavz"');
    expect(workflow).toContain("WORLD_V2_RELEASE_SOURCE_COMMIT");
    expect(workflow).toContain("--data-binary \"@$RUNNER_TEMP/world-v2-release-payload.json\"");
    expect(workflow.match(/database\/query/g)).toHaveLength(1);
    expect(workflow).not.toContain("SUPABASE_DB_PASSWORD");
    expect(workflow).not.toContain("supabase db push");
    expect(workflow).not.toContain("supabase link");

    expect(nativeVerification).toContain("postgres:17-alpine");
    expect(nativeVerification).toContain("WORLD_V2_RELEASE_SOURCE_COMMIT");
    expect(nativeVerification).toContain("world_v2_release_runner_sentinel");
    expect(nativeVerification).not.toContain("SUPABASE_ACCESS_TOKEN");
    expect(nativeVerification).not.toContain("database/query");
  });

  const sourceRoot = process.env.WORLD_V2_RELEASE_SOURCE_ROOT;
  const functional = sourceRoot && existsSync(sourceRoot) ? describe : describe.skip;
  functional("with a clean reviewed World source", () => {
    it("renders all 17 ledger entries inside one fail-closed transaction", () => {
      const outputRoot = mkdtempSync(path.join(tmpdir(), "world-v2-publisher-"));
      const payloadPath = path.join(outputRoot, "payload.json");
      const expectationPath = path.join(outputRoot, "expectation.json");
      try {
        const stdout = execFileSync(
          process.execPath,
          [
            "scripts/render-world-v2-release-query.mjs",
            "--output",
            payloadPath,
            "--expectation-output",
            expectationPath,
          ],
          {
            cwd: process.cwd(),
            encoding: "utf8",
            env: { ...process.env, WORLD_V2_RELEASE_SOURCE_ROOT: sourceRoot },
          },
        );
        const payload = JSON.parse(readFileSync(payloadPath, "utf8"));
        const expectation = JSON.parse(readFileSync(expectationPath, "utf8"));
        expect(stdout).toBe("WORLD_V2_RELEASE_PAYLOAD_READY\n");
        expect(payload).toEqual({ query: expect.any(String) });
        expect(payload.query).toMatch(/^begin;/);
        expect(payload.query).toContain("WORLD_V2_NAMESPACE_MUST_BE_ABSENT");
        expect(payload.query).toContain("WORLD_V2_PROTECTED_CATALOG_CHANGED");
        expect(payload.query).toContain("commit;\n\nselect jsonb_build_object");
        expect(
          payload.query.match(/insert into world_v2\.schema_release/g),
        ).toHaveLength(17);
        expect(expectation).toMatchObject({
          handoff_source_commit: "02f59be5026cdf2131eaf6e7fd907d5b87e987b3",
          migration_count: 17,
          table_count: 21,
        });
        expect(expectation.schema_release).toHaveLength(17);
      } finally {
        rmSync(outputRoot, { force: true, recursive: true });
      }
    });
  });
});
