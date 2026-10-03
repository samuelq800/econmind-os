import { createHash } from "node:crypto";
import { access, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import manifest from "./world-v2-source-snapshot-manifest.json" with { type: "json" };
import {
  diagnoseSnapshotBucket,
  SNAPSHOT_PROJECT_REF,
  SNAPSHOT_BUCKET,
} from "./world-v2-source-snapshot-transport.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const BUCKET_DIAGNOSTIC_ID =
  "CT-SNAPSHOT-BUCKET-DIAGNOSTIC-37044748085-V1";
export const BUCKET_DIAGNOSTIC_CONFIRMATION =
  "BUCKET_DIAGNOSTIC_GO_WORLD_V2_SOURCE_SNAPSHOT_ONCE";
const MANAGEMENT_URL = `https://api.supabase.com/v1/projects/${SNAPSHOT_PROJECT_REF}/api-keys?reveal=true`;
const BUCKET_URL = `https://${SNAPSHOT_PROJECT_REF}.supabase.co/storage/v1/bucket/${SNAPSHOT_BUCKET}`;
const FILES = [
  ".github/workflows/diagnose-world-v2-snapshot-bucket.yml",
  "scripts/world-v2-snapshot-bucket-diagnostic.mjs",
  "scripts/world-v2-source-snapshot-transport.mjs",
  "scripts/world-v2-source-snapshot-manifest.json",
  "scripts/run-world-v2-source-snapshot-release.mjs",
  "scripts/world-v2-source-snapshot-publisher.mjs",
  "docs/decisions/WORLD_V2_SNAPSHOT_BUCKET_DIAGNOSTIC_2026_10_03.md",
];
const fail = (code) => {
  throw new Error(code);
};
export async function bucketDiagnosticFingerprint(root = ROOT) {
  const digest = createHash("sha256");
  for (const file of FILES)
    digest
      .update(file)
      .update("\0")
      .update(await readFile(path.join(root, file)))
      .update("\0");
  return digest.digest("hex");
}
export async function verifyBucketDiagnosticLock(context, root = ROOT) {
  if (
    context.authorizationId !== BUCKET_DIAGNOSTIC_ID ||
    context.confirmation !== BUCKET_DIAGNOSTIC_CONFIRMATION ||
    context.lock !==
      `BUCKET_DIAGNOSTIC_GO:${await bucketDiagnosticFingerprint(root)}` ||
    context.projectRef !== SNAPSHOT_PROJECT_REF ||
    context.repository !== "samuelq800/econmind-os" ||
    context.ref !== "refs/heads/main" ||
    context.runAttempt !== "1" ||
    !/^[a-f0-9]{40}$/u.test(context.sha ?? "") ||
    typeof context.managementToken !== "string" ||
    !context.managementToken
  )
    fail("SNAPSHOT_BUCKET_DIAGNOSTIC_HOLD");
}
const failures = new Set([
  "SNAPSHOT_TRANSPORT_MANIFEST_INVALID",
  "SNAPSHOT_PUBLISHER_CONTEXT_INVALID",
  "SNAPSHOT_PUBLISHER_KEY_ACQUISITION_FAILED",
  "SNAPSHOT_PUBLISHER_KEY_RESPONSE_INVALID",
  "SNAPSHOT_PUBLISHER_KEY_METADATA_INVALID",
  "SNAPSHOT_PUBLISHER_KEY_NOT_FOUND",
  "SNAPSHOT_PUBLISHER_KEY_MULTIPLE",
  "SNAPSHOT_PUBLISHER_KEY_TYPE_INVALID",
  "SNAPSHOT_PUBLISHER_KEY_INVALID",
  "SNAPSHOT_TRANSPORT_JSON_INVALID",
  "SNAPSHOT_BUCKET_DIAGNOSTIC_REQUEST_FAILED",
  "SNAPSHOT_BUCKET_DIAGNOSTIC_REDIRECT_REJECTED",
  "SNAPSHOT_BUCKET_DIAGNOSTIC_RESPONSE_INVALID",
]);
export async function collectBucketDiagnostic(
  context,
  { fetchRequest = fetch, root = ROOT } = {},
) {
  await verifyBucketDiagnosticLock(context, root); // no contact before independent lock
  const counts = { management_key_get: 0, storage_bucket_get: 0, write: 0 };
  const restrictedFetch = async (url, init) => {
    if (
      init.method === "GET" &&
      url === MANAGEMENT_URL &&
      counts.management_key_get === 0 &&
      counts.storage_bucket_get === 0
    )
      counts.management_key_get++;
    else if (
      init.method === "GET" &&
      url === BUCKET_URL &&
      counts.management_key_get === 1 &&
      counts.storage_bucket_get === 0
    )
      counts.storage_bucket_get++;
    else fail("SNAPSHOT_BUCKET_DIAGNOSTIC_REQUEST_FAILED");
    return fetchRequest(url, init);
  };
  const identity = {
    authorization_id: BUCKET_DIAGNOSTIC_ID,
    project_ref: SNAPSHOT_PROJECT_REF,
    bucket: SNAPSHOT_BUCKET,
    main_sha: context.sha,
    fingerprint: await bucketDiagnosticFingerprint(root),
    request_counts: counts,
    key_lifecycle: "RETIRED_IN_FINALLY_BY_REVIEWED_CODE_PATH",
    publication: "NOT_RUN",
    deployment: "NOT_RUN",
    historical_failure_root_cause: "NOT_EVIDENCED",
    credential_usability_or_bucket_absence: "NOT_CLAIMED",
  };
  try {
    const observation = await diagnoseSnapshotBucket({
      manifest,
      managementToken: context.managementToken,
      fetchRequest: restrictedFetch,
    });
    const unknown = observation.error_category.includes("STOP");
    return {
      ...identity,
      status: unknown
        ? "BUCKET_DIAGNOSTIC_UNKNOWN_STOP_NO_RETRY"
        : "BUCKET_RESPONSE_OBSERVED_NOT_RELEASE_GO",
      observation,
    };
  } catch (error) {
    return {
      ...identity,
      status: "BUCKET_DIAGNOSTIC_FAILED_STOP_NO_RETRY",
      code: failures.has(error?.message)
        ? error.message
        : "SNAPSHOT_BUCKET_DIAGNOSTIC_REQUEST_FAILED",
    };
  }
}
function environmentContext() {
  return {
    lock: process.env.WORLD_V2_SNAPSHOT_BUCKET_DIAGNOSTIC_LOCK,
    confirmation: process.env.WORLD_V2_SNAPSHOT_BUCKET_DIAGNOSTIC_CONFIRMATION,
    authorizationId:
      process.env.WORLD_V2_SNAPSHOT_BUCKET_DIAGNOSTIC_AUTHORIZATION_ID,
    projectRef: process.env.SUPABASE_PROJECT_REF,
    managementToken: process.env.SUPABASE_ACCESS_TOKEN,
    repository: process.env.GITHUB_REPOSITORY,
    ref: process.env.GITHUB_REF,
    sha: process.env.GITHUB_SHA,
    runAttempt: process.env.GITHUB_RUN_ATTEMPT,
  };
}
async function main() {
  const [command, output, ...extra] = process.argv.slice(2);
  if (command === "fingerprint" && !output)
    process.stdout.write((await bucketDiagnosticFingerprint()) + "\n");
  else if (command === "diagnose-once" && output && extra.length === 0) {
    const context = environmentContext();
    await verifyBucketDiagnosticLock(context);
    try {
      await access(output);
      fail("SNAPSHOT_BUCKET_DIAGNOSTIC_RECEIPT_EXISTS");
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    const receipt = await collectBucketDiagnostic(context);
    await writeFile(output, JSON.stringify(receipt, null, 2) + "\n", {
      flag: "wx",
      mode: 0o600,
    });
    if (receipt.status !== "BUCKET_RESPONSE_OBSERVED_NOT_RELEASE_GO")
      process.exitCode = 1;
  } else fail("SNAPSHOT_BUCKET_DIAGNOSTIC_COMMAND_INVALID");
}
if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
)
  main().catch(() => {
    process.stderr.write("SNAPSHOT_BUCKET_DIAGNOSTIC_STOP\n");
    process.exitCode = 1;
  });
