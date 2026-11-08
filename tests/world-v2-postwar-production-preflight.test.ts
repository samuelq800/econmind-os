import { describe, expect, it } from "vitest";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  renderPostwarCatalogQuery,
  preparePostwarProductionPreflight,
  postwarCatalogFunctionContracts,
  // @ts-expect-error Existing Node script convention: no declarations.
} from "../scripts/world-v2-postwar-production-preflight.mjs";
import {
  loadPostwarExpandedProposalPolicy,
  // @ts-expect-error Existing Node script convention: no declarations.
} from "../scripts/world-v2-postwar-proposal-candidate.mjs";
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
  it("retains all thirteen fixed adaptation ACLs and provider lineage, rejecting drift or absent providers", async () => {
    const { policy } = await loadPostwarExpandedProposalPolicy();
    const item = policy.proposals.find(
      (p: { id: string }) =>
        p.id === "postwar-complete-opening-inventory-read-repair",
    );
    const result = postwarCatalogFunctionContracts(policy.proposals);
    for (const a of item.fixedFunctionAdaptations) {
      const c = result.find(
        (c: { qualifiedSignature: string }) =>
          c.qualifiedSignature === a.qualifiedSignature,
      );
      expect(c.proposalId).toBe(item.id);
      expect(c.executeRoles).toEqual(a.contract.executeRoles);
      expect(
        c.providerChain.map((p: { proposalId: string }) => p.proposalId),
      ).toEqual([a.predecessor, item.id]);
      expect(c.providerChain[0].contract).toEqual(c.providerChain[1].contract);
    }
    const old = policy.proposals.filter(
      (p: { id: string }) => p.id !== item.id,
    );
    expect(postwarCatalogFunctionContracts(old)).toHaveLength(134);
    expect(() =>
      postwarCatalogFunctionContracts(
        policy.proposals.filter(
          (p: { id: string }) =>
            p.id !== item.fixedFunctionAdaptations[0].predecessor,
        ),
      ),
    ).toThrow("REVIEWED_FUNCTION_REPLACEMENT_PREDECESSOR_REQUIRED");
    const changed = structuredClone(policy.proposals);
    changed.find(
      (p: { id: string }) => p.id === item.id,
    ).fixedFunctionAdaptations[0].contract.executeRoles = [];
    expect(() => postwarCatalogFunctionContracts(changed)).toThrow(
      "REVIEWED_FUNCTION_REPLACEMENT_ACL_CHANGED",
    );
    const unreviewed = structuredClone(item);
    unreviewed.id = "unreviewed-do";
    expect(() => postwarCatalogFunctionContracts([...old, unreviewed])).toThrow(
      "FIXED_COMPLETE_INVENTORY_REPAIR_ONLY",
    );
  });
  it("separates exact-signature ACL expectations from release approval and rejects duplicate contracts", async () => {
    const { policy } = await loadPostwarExpandedProposalPolicy();
    const contracts = postwarCatalogFunctionContracts(policy.proposals);
    expect(contracts).toHaveLength(146);
    expect(
      contracts.find((c: { qualifiedSignature: string }) =>
        c.qualifiedSignature.startsWith(
          "world_v2.read_postwar_mixed_current_page(",
        ),
      ),
    ).toMatchObject({
      owner: "world_v2_postwar_projection_owner",
      securityDefiner: true,
      publicExecute: false,
      executeRoles: ["world_v2_postwar_projection_reader"],
    });
    expect(() =>
      postwarCatalogFunctionContracts([
        ...policy.proposals,
        policy.proposals.find(
          (p: { id: string }) =>
            p.id === "postwar-mixed-current-projection-read",
        ),
      ]),
    ).toThrow("DUPLICATE_EXACT_FUNCTION_CATALOG_CONTRACT");
    const query = await renderPostwarCatalogQuery();
    expect(query).toContain("'exactFunctionContracts'");
    expect(query).toContain("pg_catalog.to_regprocedure");
    expect(query).toContain("'unexpectedDirectExecuteGrantees'");
    expect(query).toContain("'productionReleaseApproved',false");
    expect(query).toContain("'definerColumnReadContracts'");
    expect(query).toContain("'actualSelectColumns'");
  });
  it("retains exactly the seven reviewed ordered provider chains and their unchanged ACLs", async () => {
    const { policy } = await loadPostwarExpandedProposalPolicy();
    const contracts = postwarCatalogFunctionContracts(policy.proposals);
    const read = contracts.find(
      (v: { qualifiedSignature: string }) =>
        v.qualifiedSignature ===
        "world_v2.read_postwar_mixed_current_page(text,text,text,integer,integer,text)",
    );
    expect(read.proposalId).toBe("postwar-paged-current-projection");
    expect(
      read.providerChain.map((v: { proposalId: string }) => v.proposalId),
    ).toEqual([
      "postwar-mixed-current-projection-read",
      "postwar-paged-current-projection",
    ]);
    const apply = contracts.find(
      (v: { qualifiedSignature: string }) =>
        v.qualifiedSignature ===
        "world_v2.postwar_apply_current_frame_page(text,text,jsonb)",
    );
    expect(apply.proposalId).toBe("postwar-mixed-industry-current-effects");
    expect(
      apply.providerChain.map((v: { proposalId: string }) => v.proposalId),
    ).toEqual([
      "postwar-paged-current-projection",
      "postwar-mixed-industry-current-effects",
    ]);
    const captain = contracts.find(
      (v: { qualifiedSignature: string }) =>
        v.qualifiedSignature ===
        "world_v2.read_postwar_captain_current_page(text,integer,integer,text)",
    );
    expect(captain.proposalId).toBe("postwar-captain-h0-current");
    expect(
      captain.providerChain.map((v: { proposalId: string }) => v.proposalId),
    ).toEqual([
      "postwar-paged-current-projection",
      "postwar-captain-h0-current",
    ]);
    const alias = contracts.find(
      (v: { qualifiedSignature: string }) =>
        v.qualifiedSignature ===
        "world_v2.read_postwar_captain_current_page_before_h0_v1(text,integer,integer,text)",
    );
    expect(alias).toMatchObject({
      owner: captain.owner,
      securityDefiner: true,
      searchPath: "pg_catalog",
      publicExecute: false,
      executeRoles: [],
      proposalId: "postwar-captain-h0-current",
    });
    expect(
      contracts.filter(
        (v: { providerChain: unknown[] }) => v.providerChain.length > 1,
      ),
    ).toHaveLength(20);
    for (const [signature, predecessor, successor] of [
      [
        "world_v2.read_postwar_industry_first_day_source(text,text,text,bigint,bigint)",
        "postwar-industry-first-day-source",
        "postwar-industry-power-service-source",
      ],
      [
        "world_v2.publish_postwar_industry_work_due(text,text,text,text,text,timestamptz,text,text,text)",
        "postwar-industry-work-publication",
        "postwar-industry-power-service-source",
      ],
      [
        "world_v2.postwar_projection_industry_original(text,jsonb,jsonb)",
        "postwar-mixed-industry-current-effects",
        "postwar-industry-power-service-current",
      ],
      [
        "world_v2.postwar_mixed_industry_work_group(text,jsonb,jsonb,jsonb,jsonb,jsonb)",
        "postwar-mixed-industry-current-effects",
        "postwar-industry-power-service-current",
      ],
    ]) {
      const entry = contracts.find(
        (v: { qualifiedSignature: string }) =>
          v.qualifiedSignature === signature,
      );
      expect(
        entry.providerChain.map((v: { proposalId: string }) => v.proposalId),
      ).toEqual([predecessor, successor]);
      expect(entry.providerChain[0].contract).toEqual(
        entry.providerChain[1].contract,
      );
      const pair = [predecessor, successor].map((id) => {
        const proposal = policy.proposals.find(
          (v: { id: string }) => v.id === id,
        );
        return {
          ...proposal,
          functionContracts: proposal.functionContracts.filter(
            (v: { qualifiedSignature: string }) =>
              v.qualifiedSignature === signature,
          ),
        };
      });
      expect(() => postwarCatalogFunctionContracts([pair[1]])).toThrow(
        "REVIEWED_FUNCTION_REPLACEMENT_PREDECESSOR_REQUIRED",
      );
      expect(() =>
        postwarCatalogFunctionContracts([...pair].reverse()),
      ).toThrow("REVIEWED_FUNCTION_REPLACEMENT_PREDECESSOR_REQUIRED");
      const drift = structuredClone(pair);
      drift[1].functionContracts[0].executeRoles = [
        "world_v2_unreviewed_reader",
      ];
      expect(() => postwarCatalogFunctionContracts(drift)).toThrow(
        "REVIEWED_FUNCTION_REPLACEMENT_ACL_CHANGED",
      );
    }
    expect(
      contracts.find(
        (v: { qualifiedSignature: string }) =>
          v.qualifiedSignature ===
          "world_v2.postwar_captain_allocation_options(jsonb,text)",
      ),
    ).toMatchObject({
      owner: "world_v2_postwar_projection_owner",
      securityDefiner: false,
      publicExecute: false,
      executeRoles: [],
    });
    for (const entry of [read, apply, captain])
      expect(entry.providerChain[0].contract).toEqual(
        entry.providerChain[1].contract,
      );
  });
  it("rejects a missing or reversed H0 predecessor, changed dispatcher ACL and unreviewed alias grants", async () => {
    const { policy } = await loadPostwarExpandedProposalPolicy();
    const signature =
      "world_v2.read_postwar_captain_current_page(text,integer,integer,text)";
    const pair = [
      "postwar-paged-current-projection",
      "postwar-captain-h0-current",
    ].map((id) => {
      const p = policy.proposals.find((v: { id: string }) => v.id === id);
      return {
        ...p,
        functionContracts: p.functionContracts.filter(
          (v: { qualifiedSignature: string }) =>
            v.qualifiedSignature === signature,
        ),
      };
    });
    expect(() => postwarCatalogFunctionContracts([pair[1]])).toThrow(
      "REVIEWED_FUNCTION_REPLACEMENT_PREDECESSOR_REQUIRED",
    );
    expect(() => postwarCatalogFunctionContracts([...pair].reverse())).toThrow(
      "REVIEWED_FUNCTION_REPLACEMENT_PREDECESSOR_REQUIRED",
    );
    const changed = structuredClone(pair);
    changed[1].functionContracts[0].executeRoles = [];
    expect(() => postwarCatalogFunctionContracts(changed)).toThrow(
      "REVIEWED_FUNCTION_REPLACEMENT_ACL_CHANGED",
    );
  });
  it("rejects reversed or missing providers, signature changes, and any ACL change in a reviewed chain", async () => {
    const { policy } = await loadPostwarExpandedProposalPolicy();
    const before = policy.proposals.find(
      (v: { id: string }) => v.id === "postwar-mixed-current-projection-read",
    );
    const after = policy.proposals.find(
      (v: { id: string }) => v.id === "postwar-paged-current-projection",
    );
    const signature =
      "world_v2.read_postwar_mixed_current_page(text,text,text,integer,integer,text)";
    const pair = [before, after].map((v) => ({
      ...v,
      functionContracts: v.functionContracts.filter(
        (c: { qualifiedSignature: string }) =>
          c.qualifiedSignature === signature,
      ),
    }));
    expect(() => postwarCatalogFunctionContracts([...pair].reverse())).toThrow(
      "REVIEWED_FUNCTION_REPLACEMENT_PREDECESSOR_REQUIRED",
    );
    expect(() => postwarCatalogFunctionContracts([pair[1]])).toThrow(
      "REVIEWED_FUNCTION_REPLACEMENT_PREDECESSOR_REQUIRED",
    );
    for (const field of [
      "owner",
      "securityDefiner",
      "searchPath",
      "publicExecute",
      "executeRoles",
    ]) {
      const drift = structuredClone(pair);
      const values: Record<string, unknown> = {
        owner: "world_v2_unreviewed_owner",
        securityDefiner: false,
        searchPath: "public",
        publicExecute: true,
        executeRoles: ["world_v2_unreviewed_reader"],
      };
      drift[1].functionContracts[0][field] = values[field];
      expect(() => postwarCatalogFunctionContracts(drift)).toThrow(
        "REVIEWED_FUNCTION_REPLACEMENT_ACL_CHANGED",
      );
    }
    const drift = structuredClone(pair);
    drift[1].functionContracts[0].qualifiedSignature =
      "world_v2.read_postwar_mixed_current_page(text)";
    expect(() => postwarCatalogFunctionContracts(drift)).toThrow(
      "REVIEWED_FUNCTION_REPLACEMENT_SIGNATURE_CHANGED",
    );
    const unknown = structuredClone(pair);
    unknown[1].id = "unreviewed-replacement";
    expect(() => postwarCatalogFunctionContracts(unknown)).toThrow(
      "DUPLICATE_EXACT_FUNCTION_CATALOG_CONTRACT",
    );
  });
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
