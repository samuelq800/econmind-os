import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import manifest from "./world-v2-source-snapshot-manifest.json" with { type: "json" };
import {
  prepareSnapshot,
  publishCreateOnlySnapshot,
} from "./world-v2-source-snapshot-publisher.mjs";
import {
  SNAPSHOT_BUCKET,
  SNAPSHOT_PROJECT_REF,
  SNAPSHOT_STORAGE_PERMISSION_SQL,
  verifyStorageWriteBoundary,
  withEphemeralSnapshotTransport,
} from "./world-v2-source-snapshot-transport.mjs";

export const WORLD_SOURCE_COMMIT = "ae57dc090f736ea17aa9d67b0e1295f10c97e4c6";
export const WORLD_FUNCTION_TREE = "4d38784bf907397e2a71d0f1ff654d9e3cc3991c";
const WORLD_REMOTE =
  "https://github.com/samuelq800/econmind-os-world-simulation.git";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FINGERPRINT_FILES = [
  "supabase/config.toml",
  ".github/workflows/ci.yml",
  ".github/workflows/release-world-v2-source-snapshot.yml",
  "scripts/run-world-v2-source-snapshot-release.mjs",
  "scripts/world-v2-source-snapshot-transport.mjs",
  "scripts/world-v2-source-snapshot-publisher.mjs",
  "scripts/world-v2-source-snapshot-manifest.json",
  "scripts/render-world-v2-api-full-reader-release.mjs",
  "scripts/verify-world-v2-source-snapshot-smoke.mjs",
  "scripts/verify-world-v2-edge-smoke.mjs",
  "scripts/world-v2-edge-reader-provision.mjs",
  "scripts/test-world-v2-source-snapshot-storage.sql",
  "docs/decisions/WORLD_V2_SOURCE_SNAPSHOT_FORWARD_SCOPE_2026_10_02.md",
];
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
function fail(code) {
  throw new Error(code);
}
export async function releaseFingerprint(root = ROOT) {
  const digest = createHash("sha256");
  for (const file of FINGERPRINT_FILES)
    digest
      .update(file)
      .update("\0")
      .update(await readFile(path.join(root, file)))
      .update("\0");
  return digest.digest("hex");
}
export async function verifyReleaseLock(
  phase,
  lock,
  confirmation,
  root = ROOT,
) {
  const expected =
    phase === "preflight"
      ? "PREFLIGHT_GO"
      : phase === "publish"
        ? "RELEASE_GO"
        : null;
  if (
    expected === null ||
    confirmation !== `${expected}_WORLD_V2_SOURCE_SNAPSHOT_ONCE` ||
    lock !== `${expected}:${await releaseFingerprint(root)}`
  )
    fail("WORLD_V2_SOURCE_SNAPSHOT_RELEASE_HOLD");
  return true;
}
export function verifyWorldSource(root) {
  const git = (...args) =>
    execFileSync("git", ["-C", root, ...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  try {
    if (
      git("rev-parse", "HEAD") !== WORLD_SOURCE_COMMIT ||
      git("config", "--get", "remote.origin.url") !== WORLD_REMOTE ||
      git("status", "--porcelain=v1", "--untracked-files=all") !== "" ||
      git(
        "rev-parse",
        `${WORLD_SOURCE_COMMIT}:supabase/functions/world-v2-official-read`,
      ) !== WORLD_FUNCTION_TREE ||
      git("ls-files", "supabase/functions/world-v2-official-read").split("\n")
        .length !== 25 ||
      git(
        "ls-tree",
        "-r",
        WORLD_SOURCE_COMMIT,
        "supabase/functions/world-v2-official-read",
      )
        .split("\n")
        .some((line) => !line.startsWith("100644 blob "))
    )
      fail("SNAPSHOT_WORLD_SOURCE_IDENTITY_INVALID");
  } catch {
    fail("SNAPSHOT_WORLD_SOURCE_IDENTITY_INVALID");
  }
}
export function permissionEvidence(response) {
  const rows = Array.isArray(response)
    ? response
    : Array.isArray(response?.rows)
      ? response.rows
      : Array.isArray(response?.result)
        ? response.result
        : null;
  if (
    rows?.length !== 1 ||
    !rows[0]?.evidence ||
    typeof rows[0].evidence !== "object" ||
    Array.isArray(rows[0].evidence)
  )
    fail("SNAPSHOT_PERMISSION_RESPONSE_INVALID");
  return rows[0].evidence;
}
export function permissionReceipt(rawBytes) {
  const evidence = permissionEvidence(JSON.parse(rawBytes.toString("utf8")));
  let verified = null;
  try {
    verified = verifyStorageWriteBoundary(evidence);
  } catch {
    /* collected, not approved */
  }
  return {
    status: verified?.status ?? "SNAPSHOT_STORAGE_WRITE_BOUNDARY_BLOCKED",
    query_sha256: hash(SNAPSHOT_STORAGE_PERMISSION_SQL),
    response_sha256: hash(rawBytes),
    project_ref: SNAPSHOT_PROJECT_REF,
    bucket: SNAPSHOT_BUCKET,
    verified: verified !== null,
    roles: evidence.roles,
    relations: evidence.relations,
    policies: Array.isArray(evidence.policies)
      ? evidence.policies.map((item) => ({
          table: item.table,
          command: item.command,
          permissive: item.permissive,
          applies_to: item.applies_to,
          qual_sha256: hash(String(item.qual)),
          check_sha256: hash(String(item.check)),
        }))
      : [],
    runtime_or_rpc_isolation: "NOT_CLAIMED",
    storage_write: "NOT_RUN",
    key_acquisition: "NOT_RUN",
  };
}
export async function publishVerifiedSnapshot(
  input,
  {
    publish = publishCreateOnlySnapshot,
    withTransport = withEphemeralSnapshotTransport,
    prepare = prepareSnapshot,
    verifySource = verifyWorldSource,
  } = {},
) {
  await verifyReleaseLock(
    "publish",
    input.lock,
    input.confirmation,
    input.root ?? ROOT,
  );
  verifyStorageWriteBoundary(
    permissionEvidence(JSON.parse(input.permissionBytes.toString("utf8"))),
  );
  verifySource(input.worldRoot);
  const plan = await prepare(input.worldRoot, input.proofBytes);
  const result = await withTransport(
    { manifest, managementToken: input.managementToken },
    (transport) => publish(plan, transport),
  );
  if (
    result?.status !== "WORLD_V2_SOURCE_SNAPSHOT_BYTES_VERIFIED" ||
    result.objects !== 34 ||
    result.bucket !== SNAPSHOT_BUCKET
  )
    fail("SNAPSHOT_PUBLICATION_RESULT_INVALID");
  return {
    ...result,
    world_source_commit: WORLD_SOURCE_COMMIT,
    world_function_tree: WORLD_FUNCTION_TREE,
    fingerprint: await releaseFingerprint(input.root ?? ROOT),
    storage_write: "CREATE_ONLY_34_READBACK_VERIFIED",
    deployment: "NOT_RUN",
    key_lifecycle: "RETIRED_IN_FINALLY",
    permission_response_sha256: hash(input.permissionBytes),
  };
}
export function oldFunctionIdentity(functions) {
  if (!Array.isArray(functions)) fail("SNAPSHOT_FUNCTION_METADATA_INVALID");
  const old = functions
    .filter((item) => item.slug !== "world-v2-official-read")
    .map((item) => ({
      slug: item.slug,
      id: item.id,
      version: item.version,
      status: item.status,
      verify_jwt: item.verify_jwt,
      ezbr_sha256: item.ezbr_sha256,
    }))
    .sort((a, b) => String(a.slug).localeCompare(String(b.slug)));
  if (old.length !== 7 || new Set(old.map((item) => item.slug)).size !== 7)
    fail("SNAPSHOT_OLD_FUNCTION_SCOPE_CHANGED");
  return old;
}
export function verifyUnusedFunctionScope(functions) {
  oldFunctionIdentity(functions);
  if (functions.some((item) => item.slug === "world-v2-official-read"))
    fail("SNAPSHOT_NEW_FUNCTION_ALREADY_EXISTS");
}
async function main() {
  const [command, ...args] = process.argv.slice(2);
  if (command === "fingerprint")
    process.stdout.write((await releaseFingerprint()) + "\n");
  else if (command === "guard")
    await verifyReleaseLock(
      args[0],
      process.env.WORLD_V2_SNAPSHOT_AUTHORIZATION_LOCK,
      process.env.WORLD_V2_SNAPSHOT_CONFIRMATION,
    );
  else if (command === "permissions-render")
    await writeFile(
      args[0],
      JSON.stringify({ query: SNAPSHOT_STORAGE_PERMISSION_SQL }),
      { flag: "wx", mode: 0o600 },
    );
  else if (command === "permissions-record")
    await writeFile(
      args[1],
      JSON.stringify(permissionReceipt(await readFile(args[0])), null, 2) +
        "\n",
      { flag: "wx" },
    );
  else if (command === "permissions-verify")
    verifyStorageWriteBoundary(
      permissionEvidence(JSON.parse(await readFile(args[0], "utf8"))),
    );
  else if (command === "publish") {
    const result = await publishVerifiedSnapshot({
      worldRoot: args[0],
      proofBytes: await readFile(args[1]),
      permissionBytes: await readFile(args[2]),
      lock: process.env.WORLD_V2_SNAPSHOT_AUTHORIZATION_LOCK,
      confirmation: process.env.WORLD_V2_SNAPSHOT_CONFIRMATION,
      managementToken: process.env.SUPABASE_ACCESS_TOKEN,
    });
    await writeFile(args[3], JSON.stringify(result, null, 2) + "\n", {
      flag: "wx",
    });
  } else if (command === "verify-unused-function-scope") {
    verifyUnusedFunctionScope(JSON.parse(await readFile(args[0], "utf8")));
  } else if (command === "verify-old-functions") {
    const before = JSON.parse(await readFile(args[0], "utf8"));
    const after = JSON.parse(await readFile(args[1], "utf8"));
    if (
      JSON.stringify(oldFunctionIdentity(before)) !==
      JSON.stringify(oldFunctionIdentity(after))
    )
      fail("SNAPSHOT_OLD_FUNCTION_CHANGED");
    const current = after.filter(
      (item) => item.slug === "world-v2-official-read",
    );
    if (
      current.length !== 1 ||
      current[0].status !== "ACTIVE" ||
      current[0].verify_jwt !== false ||
      current[0].version !== 1
    )
      fail("SNAPSHOT_NEW_FUNCTION_IDENTITY_INVALID");
    await writeFile(
      args[2],
      JSON.stringify(
        {
          status: "SNAPSHOT_NEW_FUNCTION_ACTIVE_OLD_IDENTITIES_UNCHANGED",
          function: current[0].slug,
          version: current[0].version,
          verify_jwt: false,
          old_function_identity_sha256: hash(
            JSON.stringify(oldFunctionIdentity(before)),
          ),
        },
        null,
        2,
      ) + "\n",
      { flag: "wx" },
    );
  } else fail("SNAPSHOT_RUNNER_ARGUMENTS_INVALID");
}
if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
) {
  try {
    await main();
  } catch (error) {
    const code =
      error instanceof Error &&
      /^(?:SNAPSHOT|WORLD_V2_SOURCE_SNAPSHOT)_[A-Z0-9_]+$/u.test(error.message)
        ? error.message
        : "SNAPSHOT_RELEASE_STEP_FAILED";
    console.error(code);
    process.exitCode = 1;
  }
}
