import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  loadPostwarExpandedProposalPolicy,
  inspectPostwarFunctionContracts,
  inspectPendingProgrammeTargetForward,
  inspectExpandedProposalBytes,
  // @ts-expect-error render-only helper has no declarations
} from "../scripts/world-v2-postwar-proposal-candidate.mjs";
import {
  postwarCatalogFunctionContracts,
  // @ts-expect-error render-only helper has no declarations
} from "../scripts/world-v2-postwar-production-preflight.mjs";

describe("November 16 exact proposal increments", () => {
  it("keeps both explicit Clock proposals and guard owner out of the default nonClock contract set", async () => {
    const { policy } = await loadPostwarExpandedProposalPolicy();
    expect(policy.proposals).toHaveLength(88);
    const excluded = policy.proposals.filter((p: { disposition: string }) =>
      p.disposition.startsWith("EXCLUDED_"),
    );
    expect(excluded.map((p: { id: string }) => p.id)).toEqual([
      "isolated-world-clock",
      "postwar-test-only-finite-clock-observation",
    ]);
    const contracts = postwarCatalogFunctionContracts(policy.proposals);
    expect(contracts).toHaveLength(159);
    expect(
      contracts.some((c: { qualifiedSignature: string }) =>
        c.qualifiedSignature.includes("finite_clock"),
      ),
    ).toBe(false);
    const clock = excluded[1];
    expect(clock.functionContracts).toHaveLength(4);
    expect(clock.createdRoles).toEqual(["world_v2_test_clock_guard_owner"]);
    expect(clock.productionApproval).toBe("NOT_GRANTED");
  });
  it("preserves six precise Social predecessor chains and inventories two actually new functions", async () => {
    const { policy } = await loadPostwarExpandedProposalPolicy();
    const item = policy.proposals.find(
      (p: { id: string }) => p.id === "postwar-social-application-prefix",
    );
    const contracts = postwarCatalogFunctionContracts(policy.proposals);
    expect(item.guardedReplacements).toHaveLength(6);
    expect(item.newFunctionSignatures).toHaveLength(2);
    for (const replacement of item.guardedReplacements) {
      const contract = contracts.find(
        (c: { qualifiedSignature: string }) =>
          c.qualifiedSignature === replacement.qualifiedSignature,
      );
      expect(contract.providerChain.at(-2).proposalId).toBe(
        replacement.predecessor,
      );
      expect(contract.providerChain.at(-1).proposalId).toBe(item.id);
      expect(contract.providerChain.at(-2).contract).toEqual(
        contract.providerChain.at(-1).contract,
      );
    }
    const noWitnessProvider = structuredClone(policy.proposals);
    const witness = noWitnessProvider.find(
      (p: { id: string }) => p.id === "postwar-social-current-derived-read",
    );
    witness.functionContracts = [];
    expect(() => postwarCatalogFunctionContracts(noWitnessProvider)).toThrow(
      "REVIEWED_FUNCTION_REPLACEMENT_PREDECESSOR_REQUIRED",
    );
  });
  (process.env.POSTWAR_PROPOSAL_METADATA_SOURCE ? it : it.skip)(
    "checks frozen FX/Clock/Social bytes and rejects changes to grouped ACLs and forward catalogs",
    async () => {
      const { policy } = await loadPostwarExpandedProposalPolicy();
      for (const id of [
        "postwar-day-one-fx-quotes-read",
        "postwar-test-only-finite-clock-observation",
        "postwar-social-application-prefix",
      ]) {
        const item = policy.proposals.find((p: { id: string }) => p.id === id);
        const bytes = await readFile(
          process.env.POSTWAR_PROPOSAL_METADATA_SOURCE + "/" + item.path,
        );
        expect(inspectExpandedProposalBytes(item, bytes).sha256).toBe(
          item.fixedSourceSha256 ?? item.fixedGuardedForwardSha256,
        );
        expect(() =>
          inspectExpandedProposalBytes(
            item,
            Buffer.concat([bytes, Buffer.from("\n-- drift")]),
          ),
        ).toThrow();
        if (id === "postwar-test-only-finite-clock-observation") {
          const changed = bytes
            .toString()
            .replace(
              /to world_v2_admission_release;/u,
              "to world_v2_admission_release,public;",
            );
          expect(() =>
            inspectPostwarFunctionContracts(item, Buffer.from(changed)),
          ).toThrow("POWER_SERVICE_FIXED_EXECUTE_DECLARATIONS_CHANGED");
          const noRevoke = bytes
            .toString()
            .replace(
              /revoke all on function world_v2\.observe_test_only_finite_clock[^;]+;/u,
              "",
            );
          expect(() =>
            inspectPostwarFunctionContracts(item, Buffer.from(noRevoke)),
          ).toThrow("POWER_SERVICE_FIXED_EXECUTE_DECLARATIONS_CHANGED");
        }
        if (id === "postwar-social-application-prefix") {
          const changed = structuredClone(item);
          changed.guardedReplacements[0].predecessorProsrcSha256 = "0".repeat(
            64,
          );
          expect(() =>
            inspectPendingProgrammeTargetForward(changed, bytes),
          ).toThrow("PENDING_TARGET_EXACT_PREDECESSOR_CHAIN_REQUIRED");
        }
      }
    },
  );
});
