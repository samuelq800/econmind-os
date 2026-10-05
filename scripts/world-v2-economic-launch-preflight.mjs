import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

// This is an offline document contract, not a release guard or an executor.
export const LAUNCH_BASELINE = Object.freeze({
  projectRef: "vimksjrhaxdpnkvgsavz",
  publisherBaseCommit: "d82a199ebd76dec1cb5d46421bb2eb6f76648514",
  publisherBaseTree: "54ff520a4b24466eecab46eaa4c51549db0130a9",
  worldCommit: "5e4b9d9ae50b04149a5a6e67478051dc1b1d8ec1",
  worldTree: "3e36c396e39a7ed9bd516e447e83254c1c72ddae",
  sourceReaderCommit: "0ec30a28d19f4ae51d81edad42d0598c356dc127",
  sourceFunctionTree: "28d7ba3e102a7b4efb5cbb74088ed2a0f85f5d5b",
  selectedPackageId: "BALANCED_2026_09_28_V1",
  selectedSourceSha256:
    "88dd44478f97d2e8893a4f11b3aaf96e256bdb13248aca0d08f097fabe10d315",
  baselineMappingSha256:
    "230f8d695c25ea839fb6415de3c4c2985dd6d95e6261fa10dbec73053dedac82",
});
export const ECONOMIC_DECISIONS = Object.freeze([
  "worldIdentity",
  "currencyBinding",
  "titleAndRiskBinding",
  "treasuryCentralBankTreatment",
  "depositLiabilityReconciliation",
  "equityReconciliation",
]);
const REFERENCES = [
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
];
const COUNTRY_IDS = Array.from(
  { length: 70 },
  (_, index) => `COUNTRY_${String(index + 1).padStart(2, "0")}`,
);
const digest = (value) => createHash("sha256").update(value).digest("hex");
const sha256 = (value) =>
  typeof value === "string" &&
  /^[a-f0-9]{64}$/u.test(value) &&
  !/^0+$/u.test(value);
const identity = (value) =>
  typeof value === "string" && /^[A-Za-z][A-Za-z0-9_-]{2,99}$/u.test(value);
// Match the pinned Core WorldId lexical contract; this is not an ID constructor.
const worldIdentity = (value) =>
  typeof value === "string" &&
  value.length <= 100 &&
  /^[A-Z][A-Z0-9]*(?:[_-][A-Z0-9]+)*$/u.test(value);
function exactKeys(value, keys) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    JSON.stringify(Object.keys(value).sort()) ===
      JSON.stringify([...keys].sort())
  );
}
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value !== null && typeof value === "object")
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonical(value[key])]),
    );
  return value;
}
function hold(code) {
  throw new Error(code);
}
function inspect(candidate, mode) {
  if (
    !exactKeys(candidate, [
      "evidenceKind",
      "baseline",
      "worldId",
      "mappingWorldId",
      "seedWorldId",
      "countryIds",
      "references",
      "economicDecisions",
      "runtime",
    ])
  )
    hold("CANDIDATE_SHAPE_OR_MISSING_FIELDS");
  const fixture = mode === "fixture";
  if (
    candidate.evidenceKind !==
    (fixture ? "FIXTURE" : "DECLARED_PRODUCTION_CANDIDATE")
  )
    hold("EVIDENCE_KIND_MISMATCH_FIXTURE_CANNOT_PASS_PRODUCTION");
  if (
    !exactKeys(candidate.baseline, Object.keys(LAUNCH_BASELINE)) ||
    Object.entries(LAUNCH_BASELINE).some(
      ([key, value]) => candidate.baseline[key] !== value,
    )
  )
    hold("EXACT_SOURCE_OR_PUBLISHER_BASELINE_MISMATCH");
  if (
    !worldIdentity(candidate.worldId) ||
    candidate.mappingWorldId !== candidate.worldId ||
    candidate.seedWorldId !== candidate.worldId ||
    (!fixture && /^FIXTURE_/u.test(candidate.worldId))
  )
    hold("SINGLE_WORLD_ID_BINDING_MISSING_OR_CONFLICTING");
  if (
    !Array.isArray(candidate.countryIds) ||
    JSON.stringify(candidate.countryIds) !== JSON.stringify(COUNTRY_IDS)
  )
    hold("EXACT_SEVENTY_COUNTRY_ROSTER_REQUIRED");
  if (
    !exactKeys(candidate.references, REFERENCES) ||
    REFERENCES.some((key) => !sha256(candidate.references[key]))
  )
    hold("REQUIRED_ARTIFACT_HASH_MISSING_OR_INVALID");
  if (!exactKeys(candidate.economicDecisions, ECONOMIC_DECISIONS))
    hold("SIX_ECONOMIC_DECISION_RECORDS_REQUIRED");
  for (const key of ECONOMIC_DECISIONS) {
    const decision = candidate.economicDecisions[key];
    if (
      !exactKeys(decision, ["decision", "recordSha256", "worldId"]) ||
      decision.decision !== (fixture ? "FIXTURE_NOT_APPROVAL" : "APPROVED") ||
      !sha256(decision.recordSha256) ||
      decision.worldId !== candidate.worldId
    )
      hold("ECONOMIC_DECISION_RECORD_MISSING_UNAPPROVED_OR_CROSS_WORLD");
  }
  const runtime = candidate.runtime;
  if (
    !exactKeys(runtime, [
      "worldId",
      "apiPrincipalRef",
      "writerPrincipalRef",
      "singleWriter",
      "noBrowserWriter",
      "withdrawStopsAdmission",
      "killStopsDispatch",
      "preserveCommittedHistory",
    ]) ||
    runtime.worldId !== candidate.worldId ||
    !identity(runtime.apiPrincipalRef) ||
    !identity(runtime.writerPrincipalRef) ||
    runtime.apiPrincipalRef === runtime.writerPrincipalRef ||
    [
      "singleWriter",
      "noBrowserWriter",
      "withdrawStopsAdmission",
      "killStopsDispatch",
      "preserveCommittedHistory",
    ].some((key) => runtime[key] !== true)
  )
    hold("RUNTIME_IDENTITY_OR_WITHDRAW_KILL_PROTOCOL_INCOMPLETE");
  return digest(JSON.stringify(canonical(candidate)));
}

/** Caller-supplied hashes/APPROVED text are claims, never authenticated authority. */
export function validateEconomicLaunchManifest(
  document,
  { mode = "production" } = {},
) {
  const base = {
    schemaVersion: "WORLD_V2_OFFLINE_LAUNCH_PREFLIGHT_V1",
    launchAllowed: false,
    productionExecution: "NOT_AVAILABLE",
    authorityVerification: "NOT_PERFORMED_OFFLINE",
    networkRequests: 0,
    databaseOperations: 0,
    workerOperations: 0,
  };
  try {
    if (mode !== "production" && mode !== "fixture") hold("MODE_INVALID");
    if (
      !exactKeys(document, [
        "schemaVersion",
        "candidate",
        "independentReview",
      ]) ||
      document.schemaVersion !== "WORLD_V2_ECONOMIC_LAUNCH_MANIFEST_V1"
    )
      hold("MANIFEST_SHAPE_OR_VERSION_INVALID");
    const candidateSha256 = inspect(document.candidate, mode);
    const review = document.independentReview;
    if (
      !exactKeys(review, ["decision", "recordSha256", "candidateSha256"]) ||
      review.decision !==
        (mode === "fixture" ? "FIXTURE_NOT_APPROVAL" : "TECHNICAL_GO") ||
      !sha256(review.recordSha256) ||
      review.candidateSha256 !== candidateSha256
    )
      hold("INDEPENDENT_REVIEW_REFERENCE_OR_SUBJECT_MISMATCH");
    return {
      ...base,
      status:
        mode === "fixture"
          ? "FIXTURE_NOT_APPROVAL"
          : "OFFLINE_MANIFEST_COMPLETE_AUTHORITY_UNVERIFIED",
      candidateSha256,
      productionDisposition:
        "HOLD_SEPARATE_B_REVIEW_AND_ROOT_AUTHORIZATION_REQUIRED",
      referencedBytesVerified: false,
      currentDatabaseStateVerified: false,
    };
  } catch (error) {
    const codes = new Set([
      "MODE_INVALID",
      "MANIFEST_SHAPE_OR_VERSION_INVALID",
      "CANDIDATE_SHAPE_OR_MISSING_FIELDS",
      "EVIDENCE_KIND_MISMATCH_FIXTURE_CANNOT_PASS_PRODUCTION",
      "EXACT_SOURCE_OR_PUBLISHER_BASELINE_MISMATCH",
      "SINGLE_WORLD_ID_BINDING_MISSING_OR_CONFLICTING",
      "EXACT_SEVENTY_COUNTRY_ROSTER_REQUIRED",
      "REQUIRED_ARTIFACT_HASH_MISSING_OR_INVALID",
      "SIX_ECONOMIC_DECISION_RECORDS_REQUIRED",
      "ECONOMIC_DECISION_RECORD_MISSING_UNAPPROVED_OR_CROSS_WORLD",
      "RUNTIME_IDENTITY_OR_WITHDRAW_KILL_PROTOCOL_INCOMPLETE",
      "INDEPENDENT_REVIEW_REFERENCE_OR_SUBJECT_MISMATCH",
    ]);
    return {
      ...base,
      status: "HOLD",
      code: codes.has(error?.message) ? error.message : "INVALID_DOCUMENT",
    };
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length > 1 || (args.length === 1 && args[0] !== "--fixture"))
    throw new Error("INVALID_INPUT");
  const chunks = [];
  let size = 0;
  for await (const chunk of process.stdin) {
    size += chunk.length;
    if (size > 65_536) throw new Error("INVALID_INPUT");
    chunks.push(chunk);
  }
  const result = validateEconomicLaunchManifest(
    JSON.parse(Buffer.concat(chunks).toString("utf8")),
    { mode: args.length === 1 ? "fixture" : "production" },
  );
  process.stdout.write(JSON.stringify(result) + "\n");
  // A complete document is not a production gate pass. Default mode always HOLDs.
  process.exitCode = result.status === "FIXTURE_NOT_APPROVAL" ? 0 : 1;
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1])
  main().catch(() => {
    process.stdout.write(
      JSON.stringify({
        status: "HOLD",
        code: "INVALID_INPUT",
        launchAllowed: false,
      }) + "\n",
    );
    process.exitCode = 1;
  });
