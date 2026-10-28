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
  it("has an explicit eighteen-file dependency order and no pretend final SHA", async () => {
    const { policy } = await loadPostwarExpandedProposalPolicy();
    expect(policy.sourceCommit).toBeNull();
    expect(policy.installationAllowed).toBe(false);
    expect(policy.migrationApproval).toBe("NOT_GRANTED");
    expect(policy.proposals).toHaveLength(18);
    const seen = new Set<string>();
    for (const p of policy.proposals) {
      expect(p.path).toBe(`database/proposals/${p.id}.sql`);
      expect(p.dependencies.every((d: string) => seen.has(d))).toBe(true);
      expect(p.registration).toBe("UNREGISTERED_SOURCE_PROPOSAL");
      seen.add(p.id);
    }
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
      (p) => p.id === "finance-budget-mixed-source",
    );
    expect(mixed.sourceRoleDeps.world_v2_postwar_projection_owner).toBe(
      "postwar-office-derived-read",
    );
    const changed = structuredClone(policy);
    changed.proposals.find(
      (p) => p.id === "finance-budget-mixed-source",
    ).sourceRoleDeps.world_v2_postwar_projection_owner =
      "finance-budget-custody";
    expect(() => validateExpandedProposalRoleDependencies(changed)).toThrow(
      "SOURCE_ROLE_PROVIDER_DEPENDENCY_REQUIRED",
    );
    const skipped = structuredClone(policy);
    skipped.proposals.find(
      (p) => p.id === "finance-budget-mixed-source",
    ).dependencies = ["finance-budget-capacity-source"];
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
    "compares all eighteen actual proposal object/role inventories without selecting a final candidate",
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
