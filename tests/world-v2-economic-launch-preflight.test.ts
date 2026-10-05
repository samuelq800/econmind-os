import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  LAUNCH_BASELINE,
  ECONOMIC_DECISIONS,
  validateEconomicLaunchManifest,
  // @ts-expect-error Offline Node helper has no declarations.
} from "../scripts/world-v2-economic-launch-preflight.mjs";

const hash = (s: string) => createHash("sha256").update(s).digest("hex");
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value !== null && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b, "en"))
        .map(([key, item]) => [key, canonical(item)]),
    );
  return value;
}
function fixture(productionClaims = false) {
  // These hashes and identities are synthetic. No approval, seed or World is created.
  const worldId = productionClaims
    ? "DECLARED_WORLD_REFERENCE"
    : "FIXTURE_WORLD_ONLY";
  const candidate = {
    evidenceKind: productionClaims
      ? "DECLARED_PRODUCTION_CANDIDATE"
      : "FIXTURE",
    baseline: { ...LAUNCH_BASELINE },
    worldId,
    mappingWorldId: worldId,
    seedWorldId: worldId,
    countryIds: Array.from(
      { length: 70 },
      (_, i) => `COUNTRY_${String(i + 1).padStart(2, "0")}`,
    ),
    references: Object.fromEntries(
      [
        "admittedMappingSha256",
        "coverageSha256",
        "seedSha256",
        "schemaChainSha256",
        "leastPrivilegeReviewSha256",
        "oldPublicHoldDispositionSha256",
        "trustedHostBindingSha256",
        "apiBridgeSha256",
        "singleWriterProtocolSha256",
        "withdrawKillProtocolSha256",
        "recoveryRollbackProtocolSha256",
      ].map((key) => [key, hash(`synthetic-reference-${key}`)]),
    ),
    economicDecisions: Object.fromEntries(
      (ECONOMIC_DECISIONS as string[]).map((key) => [
        key,
        {
          decision: productionClaims ? "APPROVED" : "FIXTURE_NOT_APPROVAL",
          recordSha256: hash(`synthetic-decision-${key}`),
          worldId,
        },
      ]),
    ),
    runtime: {
      worldId,
      apiPrincipalRef: "DECLARED_API_PRINCIPAL_REFERENCE",
      writerPrincipalRef: "DECLARED_WRITER_PRINCIPAL_REFERENCE",
      singleWriter: true,
      noBrowserWriter: true,
      withdrawStopsAdmission: true,
      killStopsDispatch: true,
      preserveCommittedHistory: true,
    },
  };
  return {
    schemaVersion: "WORLD_V2_ECONOMIC_LAUNCH_MANIFEST_V1",
    candidate,
    independentReview: {
      decision: productionClaims ? "TECHNICAL_GO" : "FIXTURE_NOT_APPROVAL",
      recordSha256: hash("synthetic-independent-review"),
      candidateSha256: hash(JSON.stringify(canonical(candidate))),
    },
  };
}
const inspect = (document: unknown) =>
  validateEconomicLaunchManifest(document, { mode: "fixture" });
const script = fileURLToPath(
  new URL("../scripts/world-v2-economic-launch-preflight.mjs", import.meta.url),
);
function cli(input: string, args: string[] = []) {
  return spawnSync(process.execPath, [script, ...args], {
    input,
    encoding: "utf8",
    timeout: 5_000,
    env: {
      NODE_ENV: "test",
      WORLD_V2_RELEASE_LOCK: "synthetic-ignored",
      ECONMIND_ENV: "production",
    },
  });
}

describe("offline economic launch document preparation, never a production gate", () => {
  it("HOLDs missing/null documents without defaults", () => {
    for (const value of [null, {}, [], { schemaVersion: "old" }])
      expect(inspect(value)).toMatchObject({
        status: "HOLD",
        launchAllowed: false,
      });
  });
  it("accepts one complete fixture only as FIXTURE_NOT_APPROVAL, with zero operations", () => {
    expect(inspect(fixture())).toMatchObject({
      status: "FIXTURE_NOT_APPROVAL",
      launchAllowed: false,
      networkRequests: 0,
      databaseOperations: 0,
      workerOperations: 0,
      authorityVerification: "NOT_PERFORMED_OFFLINE",
      referencedBytesVerified: false,
      currentDatabaseStateVerified: false,
    });
  });
  it("rejects fixture in default production mode", () => {
    expect(validateEconomicLaunchManifest(fixture())).toMatchObject({
      status: "HOLD",
      code: "EVIDENCE_KIND_MISMATCH_FIXTURE_CANNOT_PASS_PRODUCTION",
    });
  });
  it("complete production-shaped claims remain authority-unverified and non-executable", () => {
    const doc = fixture(true);
    expect(validateEconomicLaunchManifest(doc)).toMatchObject({
      status: "OFFLINE_MANIFEST_COMPLETE_AUTHORITY_UNVERIFIED",
      launchAllowed: false,
      productionExecution: "NOT_AVAILABLE",
      productionDisposition:
        "HOLD_SEPARATE_B_REVIEW_AND_ROOT_AUTHORIZATION_REQUIRED",
    });
    expect(cli(JSON.stringify(doc)).status).toBe(1);
  });
  it("pins every project/source/function/whole-tree/publisher baseline field", () => {
    for (const key of Object.keys(LAUNCH_BASELINE)) {
      const doc = fixture();
      doc.candidate.baseline[key] = "drift";
      expect(inspect(doc)).toMatchObject({
        status: "HOLD",
        code: "EXACT_SOURCE_OR_PUBLISHER_BASELINE_MISMATCH",
      });
    }
  });
  it("requires every admitted mapping/seed/schema/runtime/protocol artifact hash", () => {
    for (const key of Object.keys(fixture().candidate.references)) {
      const doc = fixture();
      delete doc.candidate.references[key];
      expect(inspect(doc).status).toBe("HOLD");
    }
  });
  it("rejects null, non-hash and all-zero hashes", () => {
    for (const value of [null, "main", "0".repeat(64), "f".repeat(40)]) {
      const doc = fixture();
      doc.candidate.references.seedSha256 = value as string;
      expect(inspect(doc).status).toBe("HOLD");
    }
  });
  it("requires all six explicit decisions, not a ready flag or selected-source approval", () => {
    for (const key of ECONOMIC_DECISIONS as string[]) {
      const doc = fixture();
      delete doc.candidate.economicDecisions[key];
      expect(inspect(doc).status).toBe("HOLD");
    }
  });
  it("rejects unapproved or missing decision records", () => {
    const doc = fixture();
    doc.candidate.economicDecisions.currencyBinding.decision = "PROPOSED";
    expect(inspect(doc).status).toBe("HOLD");
    doc.candidate.economicDecisions.currencyBinding.decision =
      "FIXTURE_NOT_APPROVAL";
    doc.candidate.economicDecisions.currencyBinding.recordSha256 = "";
    expect(inspect(doc).status).toBe("HOLD");
  });
  it("requires the exact ordered 70-country mapping roster, no missing/duplicate countries", () => {
    for (const ids of [
      [],
      fixture().candidate.countryIds.slice(1),
      Array(70).fill("COUNTRY_01"),
    ]) {
      const doc = fixture();
      doc.candidate.countryIds = ids;
      expect(inspect(doc).status).toBe("HOLD");
    }
  });
  it("rejects absent and conflicting World identities across seed, mapping, decisions and runtime", () => {
    for (const key of ["worldId", "mappingWorldId", "seedWorldId"] as const) {
      const doc = fixture();
      doc.candidate[key] = "";
      expect(inspect(doc).status).toBe("HOLD");
    }
    const doc = fixture();
    doc.candidate.economicDecisions.titleAndRiskBinding.worldId = "OTHER_WORLD";
    expect(inspect(doc).status).toBe("HOLD");
    const lower = fixture();
    lower.candidate.worldId = "noncanonical-world";
    expect(inspect(lower).status).toBe("HOLD");
  });
  it("binds the independent review reference to the canonical whole candidate", () => {
    const doc = fixture();
    doc.independentReview.candidateSha256 = hash("different-candidate");
    expect(inspect(doc).status).toBe("HOLD");
    const good = fixture();
    const reversed = {
      ...good,
      candidate: Object.fromEntries(Object.entries(good.candidate).reverse()),
    };
    expect(inspect(reversed).candidateSha256).toBe(
      inspect(good).candidateSha256,
    );
  });
  it("rejects same API/writer principal and missing withdraw/kill/history safety", () => {
    const doc = fixture();
    doc.candidate.runtime.writerPrincipalRef =
      doc.candidate.runtime.apiPrincipalRef;
    expect(inspect(doc).status).toBe("HOLD");
    for (const key of [
      "singleWriter",
      "noBrowserWriter",
      "withdrawStopsAdmission",
      "killStopsDispatch",
      "preserveCommittedHistory",
    ] as const) {
      const invalid = fixture();
      invalid.candidate.runtime[key] = false;
      expect(inspect(invalid).status).toBe("HOLD");
    }
  });
  it("rejects unknown fields including secret/config/legacy-launch substitutes without echoing them", () => {
    for (const key of [
      "secret",
      "worldLaunch",
      "continuous_worlds",
      "productionAuthorization",
    ]) {
      const doc = { ...fixture(), [key]: "synthetic-private-value" };
      const result = inspect(doc);
      expect(result.status).toBe("HOLD");
      expect(JSON.stringify(result)).not.toContain("synthetic-private-value");
    }
  });
  it("CLI is bounded, fails closed and sanitized, and fixture success cannot grant launch", () => {
    for (const input of [
      "synthetic-private-invalid-json",
      "x".repeat(65_537),
    ]) {
      const result = cli(input);
      expect(result.status).toBe(1);
      expect(JSON.parse(result.stdout)).toMatchObject({
        status: "HOLD",
        launchAllowed: false,
      });
      expect(result.stdout + result.stderr).not.toContain(input);
    }
    const result = cli(JSON.stringify(fixture()), ["--fixture"]);
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      status: "FIXTURE_NOT_APPROVAL",
      launchAllowed: false,
    });
    expect(cli(JSON.stringify(fixture()), ["--execute"]).status).toBe(1);
  });
  it("has no network, file/env/key/SQL/worker/config access and rejects unknown modes", () => {
    const source = readFileSync(script, "utf8");
    expect(source).not.toMatch(
      /fetch\(|process\.env|node:(?:fs|http|https|child_process)|createClient|execFile/u,
    );
    expect(
      validateEconomicLaunchManifest(fixture(), { mode: "execute" }).status,
    ).toBe("HOLD");
  });
});
