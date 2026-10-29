import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  requireImmutableProposalCandidateSha,
  loadPostwarExpandedProposalPolicy,
  inspectExpandedProposalBytes,
  loadPostwarExpandedProposalCandidate,
  validateExpandedProposalRoleDependencies,
  // @ts-expect-error Node render-only helper has no declarations.
} from "../scripts/world-v2-postwar-proposal-candidate.mjs";

describe("expanded proposal catalog candidate is explicit, immutable and unapproved", () => {
  it.each([
    "main",
    "latest",
    "8cbe03cc",
    "a".repeat(39),
    "0".repeat(40),
    "$(echo unsafe)",
    undefined,
  ])("refuses mutable/malformed SHA %s", (value) => {
    expect(() => requireImmutableProposalCandidateSha(value)).toThrow(
      "EXPLICIT_FULL_IMMUTABLE_CANDIDATE_SHA_REQUIRED",
    );
  });
  it("has an explicit twenty-one-file dependency order and no pretend final SHA", async () => {
    const { policy } = await loadPostwarExpandedProposalPolicy();
    expect(policy.sourceCommit).toBeNull();
    expect(policy.installationAllowed).toBe(false);
    expect(policy.migrationApproval).toBe("NOT_GRANTED");
    expect(policy.proposals).toHaveLength(21);
    const seen = new Set<string>();
    for (const p of policy.proposals) {
      expect(p.path).toBe(`database/proposals/${p.id}.sql`);
      expect(p.dependencies.every((d: string) => seen.has(d))).toBe(true);
      expect(p.registration).toBe("UNREGISTERED_SOURCE_PROPOSAL");
      seen.add(p.id);
    }
    expect(policy.registeredMigrationCount + policy.proposals.length).toBe(44);
    expect(
      policy.proposals.filter(
        (p: { disposition: string }) => !p.disposition.startsWith("EXCLUDED_"),
      ).length,
    ).toBe(20);
    expect(
      policy.proposals.map((p: { reviewOrder: number }) => p.reviewOrder),
    ).toEqual(Array.from({ length: 21 }, (_, i) => i + 1));
    expect([...seen]).toContain("social-operating-match-publisher");
    expect([...seen]).toContain("postwar-social-current-derived-read");
    expect(
      policy.proposals.find(
        (p: { id: string }) => p.id === "postwar-social-current-derived-read",
      ).renamedFunctions,
    ).toEqual(["read_postwar_office_projection_h0_page"]);
    expect(policy.proposals.at(-1).disposition).toBe(
      "EXCLUDED_NOT_A_READ_DEPENDENCY",
    );
  });
  it("records bytes as observed evidence, rejects out-of-allowlist objects and requires NOLOGIN declarations", () => {
    const item = {
      id: "fixture",
      path: "database/proposals/fixture.sql",
      createdRoles: ["world_v2_fixture_reader"],
      createdRelations: ["fixture"],
      definedFunctions: [],
      renamedFunctions: [],
      registration: "UNREGISTERED_SOURCE_PROPOSAL",
      productionApproval: "NOT_GRANTED",
      sourceRoleDeps: { world_v2_fixture_reader: "fixture" },
      deniedRoleNames: [],
      roleNamePrefixContext: [],
    };
    const bytes = Buffer.from(
      "create role world_v2_fixture_reader nologin nosuperuser nobypassrls nocreatedb nocreaterole noreplication; create table world_v2.fixture(id text);",
    );
    expect(inspectExpandedProposalBytes(item, bytes)).toMatchObject({
      registration: "UNREGISTERED_SOURCE_PROPOSAL",
      productionApproval: "NOT_GRANTED",
      sha256Meaning: "OBSERVED_IMMUTABLE_CANDIDATE_BYTES_NOT_APPROVAL",
      bytes: bytes.length,
    });
    expect(() =>
      inspectExpandedProposalBytes(
        item,
        Buffer.concat([
          bytes,
          Buffer.from("create table world_v2.unlisted(id text);"),
        ]),
      ),
    ).toThrow("PROPOSAL_OBJECT_ALLOWLIST_CHANGED");
    expect(() =>
      inspectExpandedProposalBytes(
        item,
        Buffer.from(bytes.toString().replace("nologin", "login")),
      ),
    ).toThrow("DECLARED_FIXED_NOLOGIN_ROLE_REQUIREMENTS_MISSING");
    expect(() =>
      inspectExpandedProposalBytes(
        item,
        Buffer.concat([bytes, Buffer.from("create role extra_role login;")]),
      ),
    ).toThrow("PROPOSAL_ROLE_ALLOWLIST_CHANGED");
  });
  it("requires every reused source role to name its actual dependency provider and rejects unlisted grants", async () => {
    const { policy } = await loadPostwarExpandedProposalPolicy();
    const mixed = policy.proposals.find(
      (p: { id: string }) => p.id === "finance-budget-mixed-source",
    );
    expect(mixed.sourceRoleDeps).not.toHaveProperty(
      "world_v2_postwar_projection_owner",
    );
    expect(mixed.dependencies).toEqual(["finance-budget-capacity-source"]);
    const changed = structuredClone(policy);
    changed.proposals.find(
      (p: { id: string }) => p.id === "finance-budget-mixed-source",
    ).sourceRoleDeps.world_v2_postwar_projection_owner =
      "finance-budget-custody";
    expect(() => validateExpandedProposalRoleDependencies(changed)).toThrow(
      "SOURCE_ROLE_PROVIDER_DEPENDENCY_REQUIRED",
    );
    const skipped = structuredClone(policy);
    skipped.proposals.find(
      (p: { id: string }) => p.id === "finance-budget-mixed-source",
    ).dependencies = [];
    expect(() => validateExpandedProposalRoleDependencies(skipped)).toThrow(
      "SOURCE_ROLE_PROVIDER_DEPENDENCY_REQUIRED",
    );
    const item = {
      createdRoles: [],
      createdRelations: [],
      definedFunctions: [],
      renamedFunctions: [],
      sourceRoleDeps: {},
      deniedRoleNames: [],
      roleNamePrefixContext: [],
    };
    expect(() =>
      inspectExpandedProposalBytes(
        item,
        Buffer.from(
          "grant usage on schema world_v2 to world_v2_unlisted_reader;",
        ),
      ),
    ).toThrow("SOURCE_ROLE_DEPENDENCY_ALLOWLIST_CHANGED");
  });
  it("separates immutable inventory V2 attestation from legacy data and pins declared policy names", async () => {
    const { policy } = await loadPostwarExpandedProposalPolicy();
    const inventory = policy.proposals.find(
      (p: { id: string }) => p.id === "postwar-physical-inventory-provenance",
    );
    expect(inventory.dependencies).toEqual([
      "postwar-office-derived-read",
      "postwar-physical-opening-facts-read",
    ]);
    expect(inventory.versionSemantics).toContain(
      "LEGACY_DOCUMENT_AND_VERSION_UNCHANGED",
    );
    expect(inventory.createdRoles).toEqual([]);
    expect(inventory.productionReviewVerified).toBe(false);
    const item = {
      createdRoles: [],
      createdRelations: [],
      definedFunctions: [],
      renamedFunctions: [],
      sourceRoleDeps: {},
      deniedRoleNames: [],
      roleNamePrefixContext: [],
      literalCreatedPolicies: ["fixture_policy"],
    };
    expect(() =>
      inspectExpandedProposalBytes(
        item,
        Buffer.from(
          "create policy changed_policy on world_v2.fixture using(false);",
        ),
      ),
    ).toThrow("PROPOSAL_LITERAL_POLICY_ALLOWLIST_CHANGED");
  });
  it("records the separate Social intake lock group without enrolling it or altering the sealed predecessor", async () => {
    const { policy } = await loadPostwarExpandedProposalPolicy();
    const intake = policy.proposals.find(
      (p: { id: string }) => p.id === "social-intake-authorization",
    );
    expect(intake.dependencies).toContain("social-operating-custody");
    expect(intake.createdRelations).toEqual([]);
    expect(intake.createdRoles).toEqual(["world_v2_social_intake_lock_reader"]);
    expect(intake.sourceRoleDeps.world_v2_social_intake_lock_reader).toBe(
      "social-intake-authorization",
    );
    expect(intake.sourceRoleDeps.world_v2_social_source_owner).toBe(
      "social-operating-custody",
    );
    expect(intake.productionReviewVerified).toBe(false);
    expect(policy.roleEnrollment).toContain("NOT_PERFORMED");
  });
  it("inventories fixed FX custody objects without granting its source roles or including Clock", async () => {
    const { policy } = await loadPostwarExpandedProposalPolicy();
    const fx = policy.proposals.find(
      (p: { id: string }) => p.id === "postwar-day-one-fx-custody",
    );
    expect(fx.dependencies).toEqual([
      "runtime-read-binding-storage",
      "runtime-admission-publication",
    ]);
    expect(fx.baselineDependencies).toEqual([
      "0002_world_v2_command_event_ledger",
      "0011_world_v2_current_commit_authorization",
      "0013_world_v2_read_projection_boundary",
      "0016_world_v2_opening_seed",
    ]);
    expect(fx.createdRoles).toEqual([
      "world_v2_day_one_fx_source_owner",
      "world_v2_day_one_fx_source_publisher",
      "world_v2_day_one_fx_source_reader",
    ]);
    expect(fx.createdRelations).toEqual([
      "postwar_day_one_fx_source_original",
      "postwar_day_one_fx_quote_original",
      "postwar_day_one_fx_source_revocation",
      "postwar_day_one_fx_quote_revocation",
    ]);
    expect(fx.definedFunctions).toEqual([
      "postwar_day_one_fx_require_role",
      "postwar_day_one_fx_admission",
      "postwar_day_one_fx_quote_canonical",
      "publish_postwar_day_one_fx_originals",
      "lock_postwar_day_one_fx_original",
      "revoke_postwar_day_one_fx_source",
      "revoke_postwar_day_one_fx_quote",
      "lock_postwar_day_one_fx_current_authorization",
      "lock_postwar_day_one_fx_revoked_authorization",
      "lock_postwar_day_one_fx_intake_binding",
    ]);
    expect(Object.values(fx.sourceRoleDeps)).toEqual(Array(3).fill(fx.id));
    expect(fx.productionReviewVerified).toBe(false);
    expect(fx.productionApproval).toBe("NOT_GRANTED");
    expect(fx.versionSemantics).toContain("NO_RUNTIME_ENROLLMENT");
    const changed = structuredClone(policy);
    changed.proposals.find(
      (p: { id: string }) => p.id === fx.id,
    ).sourceRoleDeps.world_v2_day_one_fx_source_owner =
      "runtime-admission-publication";
    expect(() => validateExpandedProposalRoleDependencies(changed)).toThrow(
      "SOURCE_ROLE_PROVIDER_DEPENDENCY_REQUIRED",
    );
  });
  it("cannot use companion or a dirty branch as the selected World candidate", async () => {
    await expect(
      loadPostwarExpandedProposalCandidate(process.cwd(), "a".repeat(40)),
    ).rejects.toThrow("EXACT_CLEAN_WORLD_CANDIDATE_REQUIRED");
  });
  it("has no SQL executor, network/credential lookup or production action", async () => {
    const code = await readFile(
      "scripts/world-v2-postwar-proposal-candidate.mjs",
      "utf8",
    );
    expect(code).not.toMatch(
      /\bfetch\s*\(|process\.env|from ["'](?:pg|https|http|@supabase)|execFileSync\(["'](?:curl|gh|psql|supabase)/u,
    );
  });
  (process.env.POSTWAR_PROPOSAL_METADATA_SOURCE ? it : it.skip)(
    "compares all twenty-one actual proposal object/role inventories without selecting a final candidate",
    async () => {
      const { policy } = await loadPostwarExpandedProposalPolicy();
      for (const item of policy.proposals) {
        const bytes = await readFile(
          process.env.POSTWAR_PROPOSAL_METADATA_SOURCE + "/" + item.path,
        );
        expect(inspectExpandedProposalBytes(item, bytes).sha256Meaning).toBe(
          "OBSERVED_IMMUTABLE_CANDIDATE_BYTES_NOT_APPROVAL",
        );
      }
    },
  );
  (process.env.POSTWAR_PREFLIGHT_TEST_SOURCE ? it : it.skip)(
    "never promotes the historical six-proposal 8cbe source into expanded-batch completeness",
    async () => {
      await expect(
        loadPostwarExpandedProposalCandidate(
          process.env.POSTWAR_PREFLIGHT_TEST_SOURCE!,
          "8cbe03cc125a0e59d380cd9198110f7e438c70ab",
        ),
      ).rejects.toMatchObject({ code: "ENOENT" });
    },
  );
});
