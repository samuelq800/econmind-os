import { describe, expect, it } from "vitest";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  renderPostwarCatalogQuery,
  preparePostwarProductionPreflight,
  // @ts-expect-error Existing Node script convention: no declarations.
} from "../scripts/world-v2-postwar-production-preflight.mjs";
const stripLiterals = (sql: string) =>
  sql.replace(/'(?:''|[^'])*'/gu, "''").replace(/--[^\n]*/gu, "");
const hash = (bytes: string) =>
  createHash("sha256").update(bytes).digest("hex");
describe("fixed postwar catalog handoff never executes or grants", () => {
  it("renders a read-only snapshot ending in rollback and no mutating SQL", async () => {
    const query = await renderPostwarCatalogQuery();
    const code = stripLiterals(query);
    expect(code).toMatch(/^begin isolation level repeatable read read only;/u);
    expect(code.trim()).toMatch(/rollback;$/u);
    expect(code).not.toMatch(
      /\b(?:insert|update|delete|truncate|create|alter|drop|grant|revoke|copy|call|do|execute|set_config|pg_read_file|pg_read_binary_file|pg_ls_dir|dblink|lo_import|pg_advisory_lock|pg_sleep)\b/iu,
    );
    expect(code).not.toMatch(/for\s+(?:share|update)|into\s+\w+/iu);
  });
  it("queries only pg_catalog metadata and returns no application rows, function body or role secret/settings", async () => {
    const query = await renderPostwarCatalogQuery();
    const code = stripLiterals(query);
    const reads = [
      ...code.matchAll(/\b(?:from|join)\s+([a-z_]\w*\.[a-z_]\w*)/giu),
    ].map((match) => match[1]);
    expect(reads.length).toBeGreaterThan(10);
    expect(reads.every((name) => name?.startsWith("pg_catalog."))).toBe(true);
    expect(code).not.toMatch(
      /pg_authid|rolpassword|rolconfig|canonical_payload|auth_subject|signed_envelope|original_bytes/iu,
    );
    expect(query).toContain("'definitionSha256'");
    expect(query).toContain("'runtimeBindingVerified',false");
    expect(query).toContain("'productionReleaseApproved',false");
  });
  it("keeps optional raw-reader and excluded Clock separate from required bounded read", async () => {
    const pins = JSON.parse(
      await readFile(
        "scripts/world-v2-postwar-production-preflight-binding.json",
        "utf8",
      ),
    );
    expect(pins.proposals).toHaveLength(6);
    expect(
      pins.proposals.filter((p: { disposition: string }) =>
        p.disposition.startsWith("REQUIRED_"),
      ),
    ).toHaveLength(3);
    expect(
      pins.proposals.find(
        (p: { id: string }) => p.id === "isolated-world-clock",
      ).disposition,
    ).toBe("EXCLUDED_NOT_A_READ_DEPENDENCY");
    expect(pins.externalRolePrerequisite.status).toBe(
      "NOT_PROVISIONED_BY_ANY_CANDIDATE_SQL",
    );
    const query = await renderPostwarCatalogQuery();
    expect(query).not.toContain("isolated_clock");
    expect(pins.installationAllowed).toBe(false);
    expect(pins.productionVerified).toBe(false);
  });
  it("pins exact target/source/tree/proposal bytes and never interprets proposals as registered migrations", async () => {
    const pins = JSON.parse(
      await readFile(
        "scripts/world-v2-postwar-production-preflight-binding.json",
        "utf8",
      ),
    );
    expect(pins.projectRef).toBe("vimksjrhaxdpnkvgsavz");
    expect(pins.sourceCommit).toBe("8cbe03cc125a0e59d380cd9198110f7e438c70ab");
    expect(pins.sourceTree).toBe("d0db94d5e7aadb85a1dbe1a006bea44562e94533");
    expect(pins.registeredMigrationCount).toBe(23);
    for (const p of pins.proposals) {
      expect(p.sha256).toMatch(/^[a-f0-9]{64}$/u);
      expect(p.bytes).toBeGreaterThan(0);
      expect(p.registration).toBe("UNREGISTERED_SOURCE_PROPOSAL");
    }
    expect(hash(await renderPostwarCatalogQuery())).toHaveLength(64);
  });
  it("refuses the companion checkout as World source before output mutation", async () => {
    await expect(
      preparePostwarProductionPreflight({
        sourceRoot: process.cwd(),
        outputDirectory: "/tmp/NOT_CREATED_POSTWAR_PREFLIGHT",
      }),
    ).rejects.toThrow("EXACT_CLEAN_WORLD_CANDIDATE_REQUIRED");
  });
  it.each([
    "--execute",
    "--target",
    "--query",
    "--credential",
    "--source-root",
  ])(
    "CLI rejects %s without accepting SQL, target, secrets or execution",
    (option) => {
      const child = spawnSync(
        process.execPath,
        [
          "scripts/world-v2-postwar-production-preflight.mjs",
          option,
          "TEST_ONLY_DO_NOT_ECHO",
        ],
        { encoding: "utf8", timeout: 5000 },
      );
      expect(child.status).toBe(1);
      expect(child.stderr).toContain("NO_PRODUCTION_EXECUTION");
      expect(child.stdout + child.stderr).not.toContain(
        "TEST_ONLY_DO_NOT_ECHO",
      );
    },
  );
  it("has no network, driver, credential lookup or command dispatch", async () => {
    const source = await readFile(
      "scripts/world-v2-postwar-production-preflight.mjs",
      "utf8",
    );
    expect(source).not.toMatch(
      /\bfetch\s*\(|process\.env|from ["'](?:pg|https|http|@supabase)|workflow_dispatch|execFileSync\(['"](?:curl|gh|psql|supabase)/u,
    );
  });
  (process.env.POSTWAR_PREFLIGHT_TEST_SOURCE ? it : it.skip)(
    "writes exact immutable candidate request/expectation locally while leaving production unverified",
    async () => {
      // Optional fixture source supplied by the test runner, not a production DSN.
      const sourceRoot = process.env.POSTWAR_PREFLIGHT_TEST_SOURCE!;
      const directory = await mkdtemp(
        path.join(tmpdir(), "postwar-catalog-handoff-test-"),
      );
      try {
        const out = path.join(directory, "rendered");
        const result = await preparePostwarProductionPreflight({
          sourceRoot,
          outputDirectory: out,
        });
        const request = JSON.parse(
          await readFile(path.join(out, "request.json"), "utf8"),
        );
        expect(Object.keys(request)).toEqual(["query"]);
        expect(request.query).toBe(
          await readFile(path.join(out, "catalog.sql"), "utf8"),
        );
        expect(result).toMatchObject({
          status: "RENDERED_ONLY_PRODUCTION_NOT_VERIFIED",
          installationAllowed: false,
          databaseOperations: 0,
          networkRequests: 0,
          newCredentials: 0,
          newRoleGrants: 0,
        });
        expect(result.catalogQuerySha256).toBe(hash(request.query));
        await expect(
          preparePostwarProductionPreflight({
            sourceRoot,
            outputDirectory: out,
          }),
        ).rejects.toMatchObject({ code: "EEXIST" });
      } finally {
        await rm(directory, { recursive: true, force: true });
      }
    },
  );
});
