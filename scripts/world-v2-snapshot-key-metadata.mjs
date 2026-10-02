import { createHash } from "node:crypto";
import { access, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  SNAPSHOT_PROJECT_REF,
  snapshotPublisherKeyMetadata,
} from "./world-v2-source-snapshot-transport.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const METADATA_CONFIRMATION =
  "METADATA_GO_WORLD_V2_SNAPSHOT_KEY_METADATA_ONCE";
export const METADATA_AUTHORIZATION_ID =
  "CT-SNAPSHOT-KEY-METADATA-37038527126-V1";
export const METADATA_URL = `https://api.supabase.com/v1/projects/${SNAPSHOT_PROJECT_REF}/api-keys?reveal=false`;
const FILES = [
  ".github/workflows/diagnose-world-v2-snapshot-key-metadata.yml",
  "scripts/world-v2-snapshot-key-metadata.mjs",
  "scripts/world-v2-source-snapshot-transport.mjs",
  "scripts/run-world-v2-source-snapshot-release.mjs",
  "scripts/world-v2-source-snapshot-publisher.mjs",
  "scripts/world-v2-source-snapshot-manifest.json",
  "docs/decisions/WORLD_V2_SNAPSHOT_KEY_METADATA_DIAGNOSTIC_2026_10_03.md",
];
const fail = (code) => {
  throw new Error(code);
};
export async function metadataFingerprint(root = ROOT) {
  const digest = createHash("sha256");
  for (const file of FILES)
    digest
      .update(file)
      .update("\0")
      .update(await readFile(path.join(root, file)))
      .update("\0");
  return digest.digest("hex");
}
export async function verifyMetadataLock(context, root = ROOT) {
  if (
    context.confirmation !== METADATA_CONFIRMATION ||
    context.authorizationId !== METADATA_AUTHORIZATION_ID ||
    context.lock !== `METADATA_GO:${await metadataFingerprint(root)}` ||
    context.projectRef !== SNAPSHOT_PROJECT_REF ||
    context.repository !== "samuelq800/econmind-os" ||
    context.ref !== "refs/heads/main" ||
    context.runAttempt !== "1" ||
    !/^[a-f0-9]{40}$/u.test(context.sha ?? "") ||
    typeof context.managementToken !== "string" ||
    !context.managementToken
  )
    fail("SNAPSHOT_METADATA_DIAGNOSTIC_HOLD");
}
async function boundedMetadata(response) {
  if (!response.body) fail("SNAPSHOT_METADATA_BODY_MISSING");
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  let bytes;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      chunks.push(value);
      size += value.byteLength;
      if (size > 32_768) fail("SNAPSHOT_METADATA_BODY_LIMIT");
    }
    bytes = Buffer.concat(chunks);
    try {
      return JSON.parse(bytes.toString("utf8"));
    } catch {
      fail("SNAPSHOT_METADATA_JSON_INVALID");
    }
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
    bytes?.fill(0);
    for (const chunk of chunks) chunk.fill(0);
  }
}
const SAFE_FAILURES = new Set([
  "SNAPSHOT_METADATA_BODY_MISSING",
  "SNAPSHOT_METADATA_BODY_LIMIT",
  "SNAPSHOT_METADATA_JSON_INVALID",
  "SNAPSHOT_METADATA_RESPONSE_REJECTED",
  "SNAPSHOT_PUBLISHER_KEY_RESPONSE_INVALID",
  "SNAPSHOT_PUBLISHER_KEY_METADATA_SHAPE_INVALID",
]);
/** Only one fixed metadata GET, no key selection or Storage/deployment API.
 * Even if reveal=false unexpectedly includes values, never emit/persist them.
 * Reference/byte cleanup does not guarantee secure JS/fetch memory erasure. */
export async function collectSnapshotKeyMetadata(
  context,
  { fetchRequest = fetch, root = ROOT } = {},
) {
  await verifyMetadataLock(context, root); // before the only production request
  const identity = {
    authorization_id: METADATA_AUTHORIZATION_ID,
    project_ref: SNAPSHOT_PROJECT_REF,
    main_sha: context.sha,
    fingerprint: await metadataFingerprint(root),
    request_count: 1,
    reveal: false,
    storage_calls: 0,
    key_selection: "NOT_RUN",
    publication: "NOT_RUN",
    original_failure_root_cause: "NOT_EVIDENCED",
  };
  let entries;
  try {
    const response = await fetchRequest(METADATA_URL, {
      method: "GET",
      headers: {
        authorization: `Bearer ${context.managementToken}`,
        accept: "application/json",
      },
      redirect: "error",
      credentials: "omit",
      signal: AbortSignal.timeout(10_000),
    });
    if (
      response.status !== 200 ||
      response.redirected ||
      response.headers
        .get("content-type")
        ?.split(";")[0]
        ?.trim()
        .toLowerCase() !== "application/json"
    ) {
      await response.body?.cancel();
      fail("SNAPSHOT_METADATA_RESPONSE_REJECTED");
    }
    entries = await boundedMetadata(response);
    return {
      ...identity,
      status: "METADATA_ONLY_COLLECTED_NOT_RELEASE_GO",
      metadata: snapshotPublisherKeyMetadata(entries),
    };
  } catch (error) {
    return {
      ...identity,
      status: "METADATA_QUERY_FAILED_STOP_NO_RETRY",
      code: SAFE_FAILURES.has(error?.message)
        ? error.message
        : "SNAPSHOT_METADATA_REQUEST_FAILED",
    };
  } finally {
    if (Array.isArray(entries))
      for (const entry of entries)
        if (entry && typeof entry === "object") entry.api_key = "";
    entries = undefined;
  }
}
function environmentContext() {
  return {
    lock: process.env.WORLD_V2_SNAPSHOT_KEY_METADATA_LOCK,
    confirmation: process.env.WORLD_V2_SNAPSHOT_KEY_METADATA_CONFIRMATION,
    authorizationId:
      process.env.WORLD_V2_SNAPSHOT_KEY_METADATA_AUTHORIZATION_ID,
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
    process.stdout.write((await metadataFingerprint()) + "\n");
  else if (command === "diagnose-once" && output && extra.length === 0) {
    const context = environmentContext();
    await verifyMetadataLock(context);
    try {
      await access(output);
      fail("SNAPSHOT_METADATA_RECEIPT_ALREADY_EXISTS");
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    const receipt = await collectSnapshotKeyMetadata(context);
    await writeFile(output, JSON.stringify(receipt, null, 2) + "\n", {
      flag: "wx",
      mode: 0o600,
    });
    if (receipt.status !== "METADATA_ONLY_COLLECTED_NOT_RELEASE_GO")
      process.exitCode = 1;
  } else fail("SNAPSHOT_METADATA_COMMAND_INVALID");
}
if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
)
  main().catch(() => {
    process.stderr.write("SNAPSHOT_METADATA_DIAGNOSTIC_STOP\n");
    process.exitCode = 1;
  });
