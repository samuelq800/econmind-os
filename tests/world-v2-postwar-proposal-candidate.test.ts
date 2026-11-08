import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  requireImmutableProposalCandidateSha,
  loadPostwarExpandedProposalPolicy,
  inspectExpandedProposalBytes,
  loadPostwarExpandedProposalCandidate,
  validateExpandedProposalRoleDependencies,
  validatePostwarFinancialPostingReplacement,
  inspectPostwarFunctionContracts,
  inspectPostwarDefinerColumnReads,
  inspectPostwarTradeConstraintExtension,
  inspectPostwarCaptainAllocationOptions,
  inspectCompleteOpeningInventoryRepair,
  // @ts-expect-error Node render-only helper has no declarations.
} from "../scripts/world-v2-postwar-proposal-candidate.mjs";

describe("expanded proposal catalog candidate is explicit, immutable and unapproved", () => {
  it("records two declared complete-inventory RPCs and thirteen exact existing-function adaptations without granting authority", async () => {
    const { policy } = await loadPostwarExpandedProposalPolicy();
    const item = policy.proposals.find(
      (p: { id: string }) =>
        p.id === "postwar-complete-opening-inventory-read-repair",
    );
    expect(item.reviewOrder).toBe(80);
    expect(item.definedFunctions).toEqual([
      "postwar_complete_opening_inventory_document",
      "publish_postwar_complete_opening_inventory",
    ]);
    expect(item.definedFunctionSignatures).toHaveLength(2);
    expect(item.fixedFunctionAdaptations).toHaveLength(13);
    expect(item.fixedAdaptationSqlSha256).toBe(
      "aa47ebbae894c4c9f0dbaff22a18757962a294e5fa18fb0fcea802ae8454cb37",
    );
    expect(item.createdRoles).toEqual([]);
    expect(item.createdRelations).toEqual([]);
    expect(item.permissionDelta.membershipEnrollment).toBe(false);
    expect(item.permissionDelta.boundedRuntimeRawSeedSelect).toBe(false);
    for (const adaptation of item.fixedFunctionAdaptations) {
      const previous = policy.proposals.find(
        (p: { id: string }) => p.id === adaptation.predecessor,
      );
      expect(previous.reviewOrder).toBeLessThan(item.reviewOrder);
      expect(item.dependencies).toContain(previous.id);
      expect([
        ...previous.definedFunctions,
        ...previous.renamedFunctions,
      ]).toContain(adaptation.qualifiedSignature.split("(")[0].split(".")[1]);
      expect(adaptation.predecessorProsrcSha256).toMatch(/^[a-f0-9]{64}$/u);
      expect(adaptation.successorProsrcSha256).toMatch(/^[a-f0-9]{64}$/u);
    }
    expect(() =>
      inspectCompleteOpeningInventoryRepair(item, Buffer.from("unreviewed DO")),
    ).toThrow("FIXED_COMPLETE_INVENTORY_REPAIR_BYTES_REQUIRED");
    expect(() =>
      inspectCompleteOpeningInventoryRepair(
        { id: "other", fixedFunctionAdaptations: [] },
        Buffer.from(""),
      ),
    ).toThrow("FIXED_COMPLETE_INVENTORY_REPAIR_ONLY");
  });
  it("accepts only Trade's exact adjacent named derived CHECK extension", async () => {
    const { policy } = await loadPostwarExpandedProposalPolicy();
    const item = policy.proposals.find(
      (p: { id: string }) => p.id === "postwar-trade-current-projection",
    );
    const sql =
      "alter table world_v2.postwar_paged_current_document drop constraint postwar_paged_current_document_office_id_check;alter table world_v2.postwar_paged_current_document add constraint postwar_paged_current_document_office_id_check check(office_id in('FINANCE','CENTRAL_BANK','SOCIAL','CAPTAIN','TRADE'));";
    expect(
      inspectPostwarTradeConstraintExtension(item, Buffer.from(sql)),
    ).toMatchObject({ declarationOnly: true, productionApplied: false });
    for (const changed of [
      sql.split(";alter")[0] + ";",
      sql.replace("'SOCIAL',", ""),
      sql.replaceAll(
        "world_v2.postwar_paged_current_document",
        "world_v2.other_table",
      ),
      sql + "drop table world_v2.world_head;",
    ])
      expect(() =>
        inspectPostwarTradeConstraintExtension(item, Buffer.from(changed)),
      ).toThrow("EXACT_ADJACENT_TRADE_CHECK_EXTENSION_REQUIRED");
    expect(() =>
      inspectPostwarTradeConstraintExtension(
        { ...item, id: "other" },
        Buffer.from(sql),
      ),
    ).toThrow("FIXED_TRADE_DERIVED_CHECK_EXTENSION_REQUIRED");
  });
  it("keeps the Captain options helper private and immutable", () => {
    const item = { id: "postwar-captain-current-derived-read" };
    const sql =
      "create function world_v2.postwar_captain_allocation_options(p_packet jsonb,p_country text)returns jsonb language plpgsql immutable set search_path=pg_catalog as $$begin return null;end;$$;alter function world_v2.postwar_captain_allocation_options(jsonb,text)owner to world_v2_postwar_projection_owner;revoke all on function world_v2.postwar_captain_allocation_options(jsonb,text)from public;";
    expect(() =>
      inspectPostwarCaptainAllocationOptions(item, Buffer.from(sql)),
    ).not.toThrow();
    for (const changed of [
      sql.replace("plpgsql immutable", "plpgsql security definer"),
      sql.replace("from public", "from world_v2_postwar_projection_reader"),
      sql.replace(
        "owner to world_v2_postwar_projection_owner",
        "owner to world_v2_postwar_projection_reader",
      ),
      sql +
        "grant execute on function world_v2.postwar_captain_allocation_options(jsonb,text)to world_v2_postwar_projection_reader;",
    ])
      expect(() =>
        inspectPostwarCaptainAllocationOptions(item, Buffer.from(changed)),
      ).toThrow("CAPTAIN_ALLOCATION_PRIVATE_IMMUTABLE_HELPER_REQUIRED");
  });
  it("records the immutable opening-base repair without source authority or extra permissions", async () => {
    const { policy } = await loadPostwarExpandedProposalPolicy();
    const item = policy.proposals.find(
      (p: { id: string }) => p.id === "postwar-office-opening-read-base-repair",
    );
    expect(item.createdRoles).toEqual([]);
    expect(item.createdRelations).toEqual([]);
    expect(item.literalCreatedPolicies).toEqual([]);
    expect(item.definedFunctionSignatures).toEqual([
      "world_v2.repair_postwar_office_opening_read_bases(text,text,text,text,text,text)",
    ]);
    expect(item.dependencies).toEqual([
      "postwar-office-derived-read",
      "postwar-social-current-prefix-read",
      "postwar-industry-labour-current-read",
      "postwar-source-revocation-fence",
    ]);
    expect(item.dependencies).not.toContain(
      "postwar-physical-inventory-provenance",
    );
    expect(item.dependencies).not.toContain(
      "postwar-complete-opening-inventory-read-repair",
    );
    expect(item.functionContracts[0]).toMatchObject({
      owner: "world_v2_postwar_projection_owner",
      securityDefiner: true,
      searchPath: "pg_catalog",
      publicExecute: false,
      executeRoles: ["world_v2_postwar_projection_publisher"],
    });
    expect(item.versionSemantics).toContain("NO_GENERIC_H0_GATE_RELAXATION");
    expect(item.productionApproval).toBe("NOT_GRANTED");
  });
  it("records the creation licence supplement with only fixed private owner helpers", async () => {
    const { policy } = await loadPostwarExpandedProposalPolicy();
    const item = policy.proposals.find(
      (p: { id: string }) => p.id === "postwar-social-employment-creation",
    );
    expect(item.createdRoles).toEqual([]);
    expect(item.createdRelations).toEqual([
      "postwar_social_employment_creation_licence",
    ]);
    expect(item.literalCreatedPolicies).toEqual([
      "social_creation_licence_owner",
      "social_creation_licence_world",
    ]);
    expect(item.definedFunctionSignatures).toHaveLength(3);
    expect(item.dependencies).toEqual([
      "postwar-social-current-prefix-read",
      "social-operating-custody",
      "finance-budget-custody",
    ]);
    expect(
      item.functionContracts.map((c: { executeRoles: string[] }) =>
        [...c.executeRoles].sort(),
      ),
    ).toEqual([
      ["world_v2_finance_budget_source_owner"],
      ["world_v2_finance_budget_source_owner", "world_v2_social_source_owner"],
      ["world_v2_postwar_projection_publisher"],
    ]);
    expect(
      item.functionContracts.every(
        (c: {
          owner: string;
          publicExecute: boolean;
          securityDefiner: boolean;
          searchPath: string;
        }) =>
          c.owner === "world_v2_postwar_projection_owner" &&
          !c.publicExecute &&
          c.securityDefiner &&
          c.searchPath === "pg_catalog",
      ),
    ).toBe(true);
    for (const id of [
      "finance-budget-mixed-source",
      "postwar-financial-current-derived-read",
      "postwar-mixed-current-projection-read",
      "postwar-mixed-industry-current-effects",
      "postwar-paged-current-projection",
      "postwar-social-current-derived-read",
      "postwar-social-current-prefix-read",
      "postwar-social-mixed-match-publisher",
      "postwar-social-paged-match-publisher",
    ])
      expect(
        policy.proposals.find((p: { id: string }) => p.id === id)
          .runtimePrerequisites,
      ).toContain(item.id);
    expect(item.productionApproval).toBe("NOT_GRANTED");
  });
  it("records POWER replacements only after their actual fixed providers", async () => {
    const { policy } = await loadPostwarExpandedProposalPolicy();
    for (const id of [
      "postwar-industry-power-service-source",
      "postwar-industry-power-service-current",
    ]) {
      const item = policy.proposals.find((p: { id: string }) => p.id === id);
      expect(item.createdRoles).toEqual([]);
      expect(item.createdRelations).toEqual([]);
      expect(item.permissionDelta).toMatchObject({
        membershipEnrollment: false,
        boundedRuntimeRawSeedSelect: false,
      });
      for (const replacement of item.reviewedFunctionReplacements) {
        const previous = policy.proposals.find(
          (p: { id: string }) => p.id === replacement.predecessor,
        );
        expect(previous.reviewOrder).toBeLessThan(item.reviewOrder);
        expect(item.dependencies).toContain(previous.id);
        expect(
          previous.functionContracts.find(
            (c: { qualifiedSignature: string }) =>
              c.qualifiedSignature === replacement.qualifiedSignature,
          ),
        ).toEqual(
          item.functionContracts.find(
            (c: { qualifiedSignature: string }) =>
              c.qualifiedSignature === replacement.qualifiedSignature,
          ),
        );
      }
    }
    expect(
      policy.proposals.find(
        (p: { id: string }) => p.id === "postwar-industry-first-day-source",
      ).versionSemantics,
    ).toContain("49_NOT_APPLICABLE");
    const firstday = policy.proposals.find(
      (p: { id: string }) => p.id === "postwar-industry-first-day-source",
    );
    expect(firstday.versionSemantics).toContain(
      "PINNED_ZERO_DOMESTIC_DISTANCE_IS_SOURCE_DATA_NOT_EXECUTABILITY",
    );
    expect(firstday.versionSemantics).toContain(
      "POSITIVE_DISTANCE_CORE_EXECUTION_RULE_UNCHANGED",
    );
    expect(
      firstday.functionContracts.map(
        (c: { qualifiedSignature: string }) => c.qualifiedSignature,
      ),
    ).toEqual(firstday.definedFunctionSignatures);
    expect(firstday.createdRoles).toEqual([]);
  });
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
  it("has an explicit eighty-two-file dependency order and no pretend final SHA", async () => {
    const { policy } = await loadPostwarExpandedProposalPolicy();
    expect(policy.sourceCommit).toBeNull();
    expect(policy.installationAllowed).toBe(false);
    expect(policy.migrationApproval).toBe("NOT_GRANTED");
    expect(policy.proposals).toHaveLength(82);
    const seen = new Set<string>();
    for (const p of policy.proposals) {
      expect(p.path).toBe(`database/proposals/${p.id}.sql`);
      expect(p.dependencies.every((d: string) => seen.has(d))).toBe(true);
      expect(p.registration).toBe("UNREGISTERED_SOURCE_PROPOSAL");
      seen.add(p.id);
    }
    expect(policy.registeredMigrationCount + policy.proposals.length).toBe(105);
    expect(
      policy.proposals.filter(
        (p: { disposition: string }) => !p.disposition.startsWith("EXCLUDED_"),
      ).length,
    ).toBe(81);
    expect(
      policy.proposals.map((p: { reviewOrder: number }) => p.reviewOrder),
    ).toEqual(Array.from({ length: 82 }, (_, i) => i + 1));
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
  it("records the exact H0 dispatcher, private renamed predecessor and fence prerequisite", async () => {
    const { policy } = await loadPostwarExpandedProposalPolicy();
    const h0 = policy.proposals.find(
      (p: { id: string }) => p.id === "postwar-captain-h0-current",
    );
    expect(h0.createdRoles).toEqual([]);
    expect(h0.createdRelations).toEqual([
      "postwar_captain_h0_current_document",
    ]);
    expect(h0.dependencies).toContain("postwar-paged-current-projection");
    expect(h0.runtimePrerequisites).toEqual([
      "postwar-source-revocation-fence",
    ]);
    expect(h0.renamedFunctions).toEqual([
      "read_postwar_captain_current_page_before_h0_v1",
    ]);
    expect(h0.renamedFunctionContracts).toEqual([
      {
        qualifiedSignature:
          "world_v2.read_postwar_captain_current_page_before_h0_v1(text,integer,integer,text)",
        owner: "world_v2_postwar_projection_owner",
        securityDefiner: true,
        searchPath: "pg_catalog",
        publicExecute: false,
        executeRoles: [],
      },
    ]);
    expect(h0.permissionDelta.membershipEnrollment).toBe(false);
  });
  it("pins rent metadata reads to only two seat and seven authorization columns on its inaccessible owner", async () => {
    const { policy } = await loadPostwarExpandedProposalPolicy();
    const rent = policy.proposals.find(
      (p: { id: string }) => p.id === "postwar-beneficial-housing-rent-custody",
    );
    expect(
      rent.definerColumnReadContracts.map(
        (c: { columns: string[] }) => c.columns.length,
      ),
    ).toEqual([2, 7]);
    const sql = rent.definerColumnReadContracts
      .map(
        (c: { columns: string[]; qualifiedRelation: string; role: string }) =>
          `grant select(${c.columns.join(",")})on ${c.qualifiedRelation} to ${c.role};`,
      )
      .join("\n");
    const contracts = inspectPostwarDefinerColumnReads(rent, Buffer.from(sql));
    expect(contracts).toHaveLength(2);
    for (const replacement of [
      sql.replace("select(world_id,auth_subject)", "select"),
      sql.replace(
        "world_id,auth_subject)",
        "world_id,auth_subject,created_at_real)",
      ),
      sql.replace(
        "to world_v2_beneficial_rent_source_owner",
        "to world_v2_beneficial_rent_source_reader",
      ),
      sql.replace(",active)", ")"),
    ]) {
      expect(() =>
        inspectPostwarDefinerColumnReads(rent, Buffer.from(replacement)),
      ).toThrow("RENT_DEFINER_EXACT_METADATA_COLUMN_SELECT_REQUIRED");
    }
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
      "financial-posting-decimal-validation",
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
  it("records the existing 0009 signature collision and requires the decimal fix before FX", async () => {
    const { policy } = await loadPostwarExpandedProposalPolicy();
    const fix = policy.proposals.find(
      (p: { id: string }) => p.id === "financial-posting-decimal-validation",
    );
    const fx = policy.proposals.find(
      (p: { id: string }) => p.id === "postwar-day-one-fx-custody",
    );
    expect(fix.baselineDependencies).toEqual([
      "0009_world_v2_posting_payload_integrity",
    ]);
    expect(fix.createdRoles).toEqual([]);
    expect(fix.createdRelations).toEqual([]);
    expect(fix.definedFunctions).toEqual([
      "validate_financial_posting_payload",
    ]);
    expect(fx.dependencies).toContain(fix.id);
    expect(fix.reviewOrder).toBeLessThan(fx.reviewOrder);
    expect(fix.namedFunctionReplacements).toHaveLength(1);
    expect(fix.namedFunctionReplacements[0]).toMatchObject({
      qualifiedSignature:
        "world_v2.validate_financial_posting_payload(jsonb,world_v2.financial_posting_batch)",
      baselineMigrationId: "0009_world_v2_posting_payload_integrity",
      existingObjectRequirement:
        "EXACT_EXISTING_BASELINE_SIGNATURE_REQUIRED;ABSENCE_OR_UNEXPECTED_PREDECESSOR_STOP",
      sourceHashMeaning:
        "RAW_FIXED_SQL_DECLARATION_BYTES_NOT_PG_GET_FUNCTIONDEF_HASH",
      ownerAndExecuteAcl: "PRESERVE_EXISTING;ACTUAL_CATALOG_READBACK_REQUIRED",
      productionApproval: "NOT_GRANTED",
    });
  });
  it("includes all nine mixed extensions with exact contracts, source roles and rollback boundaries, never a final candidate", async () => {
    const { policy } = await loadPostwarExpandedProposalPolicy();
    const ids = [
      "postwar-social-startup-seed-header",
      "postwar-finance-social-source-publication",
      "postwar-day-one-fx-history-read",
      "postwar-mixed-current-projection-read",
      "postwar-mixed-financial-current-publication",
      "postwar-social-mixed-match-publisher",
      "postwar-bounded-journal-read",
      "postwar-bounded-prefix-read",
      "postwar-office-recovery-read",
    ];
    for (const id of ids) {
      const entry = policy.proposals.find((p: { id: string }) => p.id === id);
      expect(entry).toBeDefined();
      expect(entry.definedFunctionSignatures).toHaveLength(
        entry.functionContracts.length,
      );
      expect(
        entry.functionContracts.every(
          (c: {
            qualifiedSignature: string;
            publicExecute: boolean;
            owner: string;
            executeRoles: string[];
          }) =>
            c.qualifiedSignature.startsWith("world_v2.") &&
            c.publicExecute === false &&
            c.owner.endsWith("_owner") &&
            c.executeRoles.every((r) => entry.sourceRoleDeps[r]),
        ),
      ).toBe(true);
      expect(entry.rollbackChecks).toContain("NO_AUTOMATIC_SQL_DOWNGRADE");
      expect(entry.rollbackChecks).toContain(
        "UNCERTAIN_COMMIT_STOP_AND_READBACK_NOT_BLIND_RETRY",
      );
      expect(entry.permissionDelta.newLoginRoles).toBe(false);
      expect(entry.permissionDelta.membershipEnrollment).toBe(false);
      expect(entry.permissionDelta.boundedRuntimeRawSeedSelect).toBe(false);
    }
    const history = policy.proposals.find(
      (p: { id: string }) => p.id === "postwar-day-one-fx-history-read",
    );
    expect(history.createdRoles).toEqual(["world_v2_day_one_fx_history_owner"]);
    expect(history.versionSemantics).toContain(
      "LATER_QUOTE_REVOCATION_DOES_NOT_ERASE_HISTORY",
    );
    const finance = policy.proposals.find(
      (p: { id: string }) =>
        p.id === "postwar-mixed-financial-current-publication",
    );
    expect(finance.dependencies).toContain(
      "postwar-mixed-current-projection-read",
    );
    expect(finance.dependencies).toContain(
      "postwar-financial-current-derived-read",
    );
    expect(policy.sourceCommit).toBeNull();
    expect(policy.finalCandidateSelected).toBe(false);
    expect(policy.installationAllowed).toBe(false);
  });
  it("keeps bounded journal access on its real non-RLS baseline boundary, fixed owner and EXECUTE-only readers", async () => {
    const { policy } = await loadPostwarExpandedProposalPolicy();
    const p = policy.proposals.find(
      (p: { id: string }) => p.id === "postwar-bounded-journal-read",
    );
    expect(p.dependencies).toEqual(["postwar-day-one-fx-history-read"]);
    expect(p.createdRoles).toEqual([]);
    expect(p.createdRelations).toEqual([]);
    expect(p.functionContracts).toEqual([
      {
        qualifiedSignature:
          "world_v2.read_postwar_bounded_journal(text,text,text)",
        owner: "world_v2_day_one_fx_history_owner",
        securityDefiner: true,
        searchPath: "pg_catalog",
        publicExecute: false,
        executeRoles: [
          "world_v2_social_source_reader",
          "world_v2_finance_budget_source_reader",
        ],
      },
    ]);
    expect(p.replayReadBounds).toMatchObject({
      financialBatchMaximum: 512,
      rawBatchMaximumBytes: 65536,
      rawBatchSetMaximumBytes: 1048576,
      worldVersionMaximum: "256",
      inventoryEffects: "REJECT_NONZERO",
    });
    expect(p.permissionDelta.baselineRlsBoundary).toContain(
      "BASELINE_FINANCIAL_AND_INVENTORY_LEDGER_TABLES_HAVE_NO_RLS",
    );
    expect(p.permissionDelta.baselineRlsBoundary).toContain(
      "DOES_NOT_GLOBALLY_ENABLE_RLS",
    );
    expect(p.sourceRoleDeps.world_v2_day_one_fx_history_owner).toBe(
      "postwar-day-one-fx-history-read",
    );
  });
  it("places complete bounded prefix after journal without raw reader history access or filtered replay", async () => {
    const { policy } = await loadPostwarExpandedProposalPolicy();
    const prefix = policy.proposals.find(
        (p: { id: string }) => p.id === "postwar-bounded-prefix-read",
      ),
      journal = policy.proposals.find(
        (p: { id: string }) => p.id === "postwar-bounded-journal-read",
      );
    expect(prefix.dependencies).toEqual([journal.id]);
    expect(prefix.reviewOrder).toBeGreaterThan(journal.reviewOrder);
    expect(prefix.createdRoles).toEqual([]);
    expect(prefix.createdRelations).toEqual([]);
    expect(prefix.functionContracts).toEqual([
      {
        qualifiedSignature:
          "world_v2.read_postwar_bounded_prefix(text,text,text)",
        owner: "world_v2_day_one_fx_history_owner",
        securityDefiner: true,
        searchPath: "pg_catalog",
        publicExecute: false,
        executeRoles: [
          "world_v2_social_source_reader",
          "world_v2_finance_budget_source_reader",
        ],
      },
    ]);
    expect(prefix.permissionDelta.newRuntimeTableDml).toBe(false);
    expect(prefix.permissionDelta.boundedRuntimeRawSeedSelect).toBe(false);
    expect(prefix.replayReadBounds).toMatchObject({
      eventMaximum: 256,
      commandMaximum: 256,
      committedReceiptMaximum: 256,
      rawEventPayloadMaximumBytes: 65536,
      rawCommandPayloadMaximumBytes: 16384,
      combinedHistoryAndRawFinancialMaximumBytes: 1048576,
      unknownOrCorrectionEffects:
        "RETURN_INTACT_REQUIRE_STRICT_CORE_REPLAY_NOT_SQL_ALLOWLIST",
    });
  });
  it("binds READ ONLY recovery to actual intake groups and exact command capability without source-reader enrollment", async () => {
    const { policy } = await loadPostwarExpandedProposalPolicy();
    const p = policy.proposals.find(
      (p: { id: string }) => p.id === "postwar-office-recovery-read",
    );
    expect(p.dependencies).toEqual([
      "postwar-office-derived-read",
      "social-intake-authorization",
      "finance-budget-custody",
      "postwar-day-one-fx-custody",
    ]);
    expect(p.createdRoles).toEqual([]);
    expect(p.createdRelations).toEqual([]);
    expect(p.functionContracts).toEqual([
      {
        qualifiedSignature:
          "world_v2.read_postwar_office_recovery_binding(text,uuid,text,text,text,text,text,text)",
        owner: "world_v2_postwar_projection_owner",
        securityDefiner: true,
        searchPath: "pg_catalog",
        publicExecute: false,
        executeRoles: [
          "world_v2_finance_budget_source_reader",
          "world_v2_day_one_fx_source_reader",
          "world_v2_social_intake_lock_reader",
        ],
      },
    ]);
    expect(p.permissionDelta.actualIntakeCapabilityGroups.SOCIAL_LABOUR).toBe(
      "world_v2_social_intake_lock_reader",
    );
    expect(p.reusedRoles).not.toContain("world_v2_social_source_reader");
    expect(p.recoveryReadContract).toMatchObject({
      requiresTransactionReadOnly: true,
      rowLocks: false,
    });
    expect(p.recoveryReadContract.requiredExactBindings).toContain(
      "COMMAND_CAPABILITY",
    );
  });
  it("rejects changed scalar signatures, function owner and execution mode before immutable rendering", () => {
    const bytes = Buffer.from(
      "create function world_v2.fixture(p_value text)returns jsonb language plpgsql security definer set search_path=pg_catalog as $$begin return null;end;$$;alter function world_v2.fixture(text)owner to world_v2_fixture_owner;",
    );
    const item = {
      definedFunctionSignatures: ["world_v2.fixture(text)"],
      functionContracts: [
        {
          qualifiedSignature: "world_v2.fixture(text)",
          owner: "world_v2_fixture_owner",
          securityDefiner: true,
          searchPath: "pg_catalog",
          publicExecute: false,
          executeRoles: [],
        },
      ],
    };
    expect(() => inspectPostwarFunctionContracts(item, bytes)).not.toThrow();
    expect(() =>
      inspectPostwarFunctionContracts(
        item,
        Buffer.from(bytes.toString().replaceAll("$$", () => "$body$")),
      ),
    ).not.toThrow();
    expect(() =>
      inspectPostwarFunctionContracts(
        item,
        Buffer.from(bytes.toString().replace("p_value text", "p_value uuid")),
      ),
    ).toThrow("PROPOSAL_FUNCTION_SIGNATURE_CHANGED");
    expect(() =>
      inspectPostwarFunctionContracts(
        item,
        Buffer.from(
          bytes
            .toString()
            .replace("owner to world_v2_fixture_owner", "owner to public"),
        ),
      ),
    ).toThrow("PROPOSAL_FUNCTION_OWNER_OR_EXECUTION_MODE_CHANGED");
    expect(() =>
      inspectPostwarFunctionContracts(
        item,
        Buffer.from(
          bytes.toString().replace("security definer", "security invoker"),
        ),
      ),
    ).toThrow("PROPOSAL_FUNCTION_OWNER_OR_EXECUTION_MODE_CHANGED");
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
    "compares all eighty-two actual proposal object/role inventories without selecting a final candidate",
    async () => {
      const { policy } = await loadPostwarExpandedProposalPolicy();
      for (const item of policy.proposals) {
        const bytes = await readFile(
          process.env.POSTWAR_PROPOSAL_METADATA_SOURCE + "/" + item.path,
        );
        expect(inspectExpandedProposalBytes(item, bytes).sha256Meaning).toBe(
          "OBSERVED_IMMUTABLE_CANDIDATE_BYTES_NOT_APPROVAL",
        );
        if (
          [
            "postwar-industry-power-service-source",
            "postwar-industry-power-service-current",
          ].includes(item.id)
        ) {
          const signature = item.functionContracts[0].qualifiedSignature;
          expect(() =>
            inspectExpandedProposalBytes(
              item,
              Buffer.concat([
                bytes,
                Buffer.from(
                  `\ngrant execute on function ${signature} to world_v2_industry_source_reader;\n`,
                ),
              ]),
            ),
          ).toThrow("POWER_SERVICE_FIXED_EXECUTE_DECLARATIONS_CHANGED");
        }
        if (item.id === "postwar-complete-opening-inventory-read-repair") {
          expect(() =>
            inspectExpandedProposalBytes(
              item,
              Buffer.concat([
                bytes,
                Buffer.from(
                  "\ngrant execute on function world_v2.postwar_complete_opening_inventory_document(text,text,text)to public;\n",
                ),
              ]),
            ),
          ).toThrow("FIXED_COMPLETE_INVENTORY_REPAIR_BYTES_REQUIRED");
          for (const change of [
            "signature",
            "predecessor",
            "oldHash",
            "owner",
            "acl",
          ]) {
            const altered = structuredClone(item);
            const a = altered.fixedFunctionAdaptations[0];
            if (change === "signature")
              a.qualifiedSignature = "world_v2.other(text)";
            if (change === "predecessor")
              a.predecessor = "runtime-read-binding-storage";
            if (change === "oldHash")
              a.predecessorProsrcSha256 = "0".repeat(64);
            if (change === "owner")
              a.contract.owner = "world_v2_postwar_projection_reader";
            if (change === "acl")
              a.contract.executeRoles.push(
                "world_v2_postwar_projection_reader",
              );
            expect(() => inspectExpandedProposalBytes(altered, bytes)).toThrow(
              "FIXED_COMPLETE_INVENTORY_ADAPTATION_CONTRACT_CHANGED",
            );
          }
        }
        if (item.id === "postwar-industry-utility-custody") {
          const overloadedName =
            "read_postwar_industry_water_grant_publication";
          expect(
            item.definedFunctions.filter(
              (name: string) => name === overloadedName,
            ),
          ).toHaveLength(1);
          for (const types of ["text,text", "text,text,text,text"]) {
            const signature = `world_v2.${overloadedName}(${types})`;
            expect(item.definedFunctionSignatures).toContain(signature);
            expect(
              item.functionContracts.find(
                (c: { qualifiedSignature: string }) =>
                  c.qualifiedSignature === signature,
              ),
            ).toMatchObject({
              owner: "world_v2_industry_source_owner",
              securityDefiner: true,
              searchPath: "pg_catalog",
              publicExecute: false,
              executeRoles: ["world_v2_industry_source_publisher"],
            });
            expect(bytes.toString()).toContain(
              `revoke all on function ${signature}from public;`,
            );
            expect(bytes.toString()).toContain(
              `grant execute on function ${signature}to world_v2_industry_source_publisher;`,
            );
          }
          expect(bytes.toString()).toContain(
            "primary key(world_id,schedule_command_id)",
          );
          expect(bytes.toString()).not.toContain(
            "primary key(world_id,run_id)",
          );
          expect(bytes.toString()).toContain(
            "read_postwar_industry_water_grant_publication(p_world,'COUNTRY_02','OPEN-02-REFINED_FUEL',p_run)",
          );
          expect(bytes.toString()).toContain(
            "return query select * from world_v2.read_postwar_industry_water_grant_publication(p_world,p_country,p_facility,p_run)",
          );
          expect(item.relationKeyReviewContracts[0].primaryKey).toEqual([
            "world_id",
            "schedule_command_id",
          ]);
        }
        if (item.id === "postwar-captain-h0-current") {
          expect(() =>
            inspectExpandedProposalBytes(
              item,
              Buffer.concat([
                bytes,
                Buffer.from(
                  "\ngrant execute on function world_v2.read_postwar_captain_current_page_before_h0_v1(text,integer,integer,text) to world_v2_postwar_projection_reader;\n",
                ),
              ]),
            ),
          ).toThrow("CAPTAIN_H0_PRIVATE_RENAMED_DISPATCHER_CONTRACT_CHANGED");
          expect(() =>
            inspectExpandedProposalBytes(
              item,
              Buffer.from(
                bytes
                  .toString()
                  .replace(
                    "from public,world_v2_postwar_projection_reader;",
                    "from public;",
                  ),
              ),
            ),
          ).toThrow("CAPTAIN_H0_PRIVATE_RENAMED_DISPATCHER_CONTRACT_CHANGED");
        }
        if (item.id === "financial-posting-decimal-validation") {
          const predecessor = item.namedFunctionReplacements[0];
          const baseline = await readFile(
            process.env.POSTWAR_PROPOSAL_METADATA_SOURCE +
              "/" +
              predecessor.baselinePath,
          );
          expect(() =>
            validatePostwarFinancialPostingReplacement(item, bytes, baseline),
          ).not.toThrow();
          expect(() =>
            inspectExpandedProposalBytes(
              item,
              Buffer.concat([
                bytes,
                Buffer.from(
                  "\ngrant execute on function world_v2.validate_financial_posting_payload(jsonb,world_v2.financial_posting_batch) to public;",
                ),
              ]),
            ),
          ).toThrow("NAMED_FUNCTION_REPLACEMENT_SOURCE_BYTES_CHANGED");
          const { createHash } = await import("node:crypto");
          const hash = (value: string | Buffer) =>
            createHash("sha256").update(value).digest("hex");
          const widened = Buffer.from(
            bytes.toString().replace("> 120", "> 121"),
          );
          const changed = structuredClone(item);
          const text = widened.toString(),
            start = text.indexOf("create or replace function");
          changed.namedFunctionReplacements[0].successorSqlSha256 =
            hash(widened);
          changed.namedFunctionReplacements[0].successorDeclarationSourceSha256 =
            hash(text.slice(start, text.indexOf("\n$$;", start) + 4));
          expect(() =>
            validatePostwarFinancialPostingReplacement(
              changed,
              widened,
              baseline,
            ),
          ).toThrow("EXACT_DECIMAL_REGEX_FORWARD_FIX_REQUIRED");
          expect(() =>
            validatePostwarFinancialPostingReplacement(
              item,
              bytes,
              Buffer.concat([baseline, Buffer.from("\n")]),
            ),
          ).toThrow("NAMED_FUNCTION_BASELINE_PREDECESSOR_CHANGED");
        }
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
