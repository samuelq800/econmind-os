import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { access, cp, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import binding from "./world-v2-reader-cors-update-binding.json" with { type: "json" };
import {
  oldFunctionIdentity,
  releaseFingerprint,
} from "./run-world-v2-source-snapshot-release.mjs";
import { verifySnapshotSmoke } from "./verify-world-v2-source-snapshot-smoke.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const UPDATE_PROJECT = "vimksjrhaxdpnkvgsavz";
export const UPDATE_SLUG = "world-v2-official-read";
export const UPDATE_ORIGINS = Object.freeze([
  "https://samuelq800.github.io",
  "https://world.econmind.group",
]);
export const UPDATE_AUTHORIZATION_ID = "CT-WORLD-V2-READER-CORS-UPDATE-V1";
export const UPDATE_CONFIRMATION = "UPDATE_WORLD_V2_READER_CORS_ONCE";
export const OLD_FUNCTION_HASH =
  "c6058e4edd593bad5b7c6ac97aceee95089af7ce1875766da6b54c1c07fb4db9";
const OLD_WORLD = "ae57dc090f736ea17aa9d67b0e1295f10c97e4c6";
const WORLD_REMOTE =
  "https://github.com/samuelq800/econmind-os-world-simulation.git";
const FUNCTION_PATH = `supabase/functions/${UPDATE_SLUG}`;
const ROUTE_URL = `https://${UPDATE_PROJECT}.supabase.co/functions/v1/${UPDATE_SLUG}/v1/world-data/datasets/countries?limit=1`;
const FILES = [
  ".github/workflows/update-world-v2-reader-cors.yml",
  "scripts/world-v2-reader-cors-update.mjs",
  "scripts/world-v2-reader-cors-update-binding.json",
  "tests/world-v2-reader-cors-update.test.ts",
  "docs/decisions/WORLD_V2_READER_CORS_UPDATE_2026_10_03.md",
];
const hash = (value) => createHash("sha256").update(value).digest("hex");
const fail = (code) => {
  throw new Error(code);
};
export function verifyUpdateBinding(value) {
  if (
    !value ||
    value.status !== "BOUND_CODE_CANDIDATE" ||
    typeof value.world_source_commit !== "string" ||
    typeof value.world_function_tree !== "string" ||
    !/^[a-f0-9]{40}$/u.test(value.world_source_commit ?? "") ||
    !/^[a-f0-9]{40}$/u.test(value.world_function_tree ?? "") ||
    value.world_source_commit === OLD_WORLD ||
    /^0+$/u.test(value.world_source_commit) ||
    /^0+$/u.test(value.world_function_tree) ||
    !Number.isInteger(value.world_function_file_count) ||
    value.world_function_file_count < 1 ||
    value.world_function_file_count > 50 ||
    !Array.isArray(value.allowed_function_changes) ||
    value.allowed_function_changes.length === 0 ||
    value.allowed_function_changes.length > 50 ||
    new Set(value.allowed_function_changes).size !==
      value.allowed_function_changes.length ||
    value.allowed_function_changes.some(
      (file) =>
        typeof file !== "string" ||
        !file.startsWith(FUNCTION_PATH + "/") ||
        file.includes("..") ||
        file.includes("\\") ||
        !/^[a-zA-Z0-9_./-]+$/u.test(file),
    )
  )
    fail("WORLD_V2_READER_UPDATE_UNBOUND_HOLD");
}
export async function readerUpdateFingerprint(root = ROOT) {
  const digest = createHash("sha256");
  for (const file of FILES)
    digest
      .update(file)
      .update("\0")
      .update(await readFile(path.join(root, file)))
      .update("\0");
  // Reuse the immutable dependency closure for the existing identity/smoke helpers.
  return digest
    .update("initial-publisher-dependencies\0")
    .update(await releaseFingerprint(root))
    .digest("hex");
}
export async function verifyUpdateGuard(
  context,
  { manifest = binding, root = ROOT } = {},
) {
  verifyUpdateBinding(manifest); // no production contact while source pins are absent
  if (
    context.repository !== "samuelq800/econmind-os" ||
    context.ref !== "refs/heads/main" ||
    context.runAttempt !== "1" ||
    !/^[a-f0-9]{40}$/u.test(context.sha ?? "") ||
    context.projectRef !== UPDATE_PROJECT ||
    context.authorizationId !== UPDATE_AUTHORIZATION_ID ||
    context.confirmation !== UPDATE_CONFIRMATION ||
    typeof context.managementToken !== "string" ||
    !context.managementToken ||
    context.lock !== `READER_UPDATE_GO:${await readerUpdateFingerprint(root)}`
  )
    fail("WORLD_V2_READER_UPDATE_HOLD");
}
export function verifyUpdateSource(
  worldRoot,
  manifest = binding,
  {
    git = (...args) =>
      execFileSync("git", ["-C", worldRoot, ...args], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      }).trim(),
  } = {},
) {
  verifyUpdateBinding(manifest);
  try {
    if (
      git("rev-parse", "HEAD") !== manifest.world_source_commit ||
      git("remote", "get-url", "origin") !== WORLD_REMOTE ||
      git("status", "--porcelain=v1", "--untracked-files=all") !== "" ||
      git("rev-parse", `HEAD:${FUNCTION_PATH}`) !==
        manifest.world_function_tree ||
      git("ls-files", FUNCTION_PATH).split("\n").length !==
        manifest.world_function_file_count ||
      git("ls-tree", "-r", "HEAD", FUNCTION_PATH)
        .split("\n")
        .some((line) => !line.startsWith("100644 blob ")) ||
      JSON.stringify(
        git("diff", "--name-only", OLD_WORLD, "HEAD", "--", FUNCTION_PATH)
          .split("\n")
          .sort(),
      ) !== JSON.stringify([...manifest.allowed_function_changes].sort())
    )
      fail("WORLD_V2_READER_UPDATE_SOURCE_INVALID");
  } catch {
    fail("WORLD_V2_READER_UPDATE_SOURCE_INVALID");
  }
}
function readerIdentity(functions, expectedVersion, expectedOldHash) {
  if (
    !Array.isArray(functions) ||
    functions.length !== 8 ||
    functions.some(
      (item) => !item || typeof item !== "object" || Array.isArray(item),
    ) ||
    new Set(functions.map((item) => item.slug)).size !== 8
  )
    fail("WORLD_V2_READER_UPDATE_IDENTITY_INVALID");
  const matches = functions.filter((item) => item.slug === UPDATE_SLUG);
  const item = matches[0];
  if (
    matches.length !== 1 ||
    item.name !== UPDATE_SLUG ||
    typeof item.id !== "string" ||
    !/^[A-Za-z0-9_-]{1,128}$/u.test(item.id) ||
    item.version !== expectedVersion ||
    item.status !== "ACTIVE" ||
    item.verify_jwt !== false ||
    typeof item.ezbr_sha256 !== "string" ||
    !/^[a-f0-9]{64}$/u.test(item.ezbr_sha256)
  )
    fail("WORLD_V2_READER_UPDATE_IDENTITY_INVALID");
  if (hash(JSON.stringify(oldFunctionIdentity(functions))) !== expectedOldHash)
    fail("WORLD_V2_READER_UPDATE_OLD_FUNCTION_CHANGED");
  return {
    id: item.id,
    slug: UPDATE_SLUG,
    name: UPDATE_SLUG,
    version: item.version,
    status: item.status,
    verify_jwt: item.verify_jwt,
    ezbr_sha256: item.ezbr_sha256,
  };
}
export function updatePreimage(functions, expectedOldHash = OLD_FUNCTION_HASH) {
  const reader = readerIdentity(functions, 1, expectedOldHash);
  return Object.freeze({
    reader: Object.freeze(reader),
    sha256: hash(JSON.stringify(reader)),
  });
}
export function verifyUpdateRecheck(
  preimage,
  functions,
  expectedOldHash = OLD_FUNCTION_HASH,
) {
  const current = updatePreimage(functions, expectedOldHash);
  if (
    current.sha256 !== preimage.sha256 ||
    JSON.stringify(current.reader) !== JSON.stringify(preimage.reader)
  )
    fail("WORLD_V2_READER_UPDATE_PREIMAGE_CHANGED");
}
export function verifyUpdateAfter(
  preimage,
  functions,
  expectedOldHash = OLD_FUNCTION_HASH,
) {
  const after = readerIdentity(functions, 2, expectedOldHash);
  if (
    after.id !== preimage.reader.id ||
    after.ezbr_sha256 === preimage.reader.ezbr_sha256
  )
    fail("WORLD_V2_READER_UPDATE_AFTER_UNKNOWN_STOP");
  return {
    status: "READER_V2_ACTIVE_SAME_ID_OLD_SEVEN_UNCHANGED",
    version: 2,
    verify_jwt: false,
    same_reader_id: true,
    preimage_identity_sha256: preimage.sha256,
    after_identity_sha256: hash(JSON.stringify(after)),
    old_function_identity_sha256: expectedOldHash,
  };
}
function smokeHeaders(response, normalizeOrigin) {
  const fields = [
    "content-type",
    "cache-control",
    "vary",
    "access-control-allow-origin",
    "access-control-allow-credentials",
    "access-control-allow-methods",
    "access-control-allow-headers",
    "x-world-source-transport",
  ];
  return (
    `HTTP/2 ${response.status}\r\n` +
    fields
      .map((name) => {
        const value =
          name === "access-control-allow-origin" && normalizeOrigin
            ? UPDATE_ORIGINS[0]
            : response.headers.get(name);
        return value === null ? "" : `${name}: ${value}\r\n`;
      })
      .join("")
  );
}
export function verifyUpdateOrigin(get, body, options, origin) {
  if (
    !UPDATE_ORIGINS.includes(origin) ||
    get.headers.get("access-control-allow-origin") !== origin ||
    options.headers.get("access-control-allow-origin") !== origin ||
    [get, options].some(
      (response) =>
        response.headers.has("access-control-allow-credentials") &&
        response.headers.get("access-control-allow-credentials") !== "false",
    )
  )
    fail("WORLD_V2_READER_UPDATE_CORS_INVALID");
  // Normalize only the already-exactly-validated ACAO field; reuse all existing
  // fixed source/body/transport/status checks without widening the old verifier.
  return {
    ...verifySnapshotSmoke(
      smokeHeaders(get, true),
      body,
      smokeHeaders(options, true),
    ),
    origin,
  };
}
async function boundedRouteJson(response) {
  if (!response.body) fail("WORLD_V2_READER_UPDATE_ROUTE_INVALID");
  const reader = response.body.getReader();
  const chunks = [];
  let count = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      count += value.byteLength;
      if (count > 262_144) fail("WORLD_V2_READER_UPDATE_ROUTE_INVALID");
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    fail("WORLD_V2_READER_UPDATE_ROUTE_INVALID");
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
const codes = new Set([
  "WORLD_V2_READER_UPDATE_IDENTITY_INVALID",
  "WORLD_V2_READER_UPDATE_OLD_FUNCTION_CHANGED",
  "WORLD_V2_READER_UPDATE_PREIMAGE_CHANGED",
  "WORLD_V2_READER_UPDATE_AFTER_UNKNOWN_STOP",
  "WORLD_V2_READER_UPDATE_CORS_INVALID",
  "WORLD_V2_READER_UPDATE_ROUTE_INVALID",
  "WORLD_V2_READER_UPDATE_METADATA_FAILED",
  "WORLD_V2_READER_UPDATE_DEPLOY_UNKNOWN_STOP",
]);
export async function runReaderUpdate(
  context,
  worldRoot,
  {
    manifest = binding,
    root = ROOT,
    verifySource = verifyUpdateSource,
    stageSource = async () => {
      const destination = path.join(root, FUNCTION_PATH);
      try {
        await access(destination);
        fail("WORLD_V2_READER_UPDATE_SOURCE_INVALID");
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
      await cp(path.join(worldRoot, FUNCTION_PATH), destination, {
        recursive: true,
        force: false,
        errorOnExist: true,
      });
    },
    listFunctions = async () => {
      try {
        return JSON.parse(
          execFileSync(
            "supabase",
            [
              "functions",
              "list",
              "--project-ref",
              UPDATE_PROJECT,
              "--output",
              "json",
            ],
            {
              timeout: 30_000,
              maxBuffer: 262_144,
              encoding: "utf8",
              stdio: ["ignore", "pipe", "pipe"],
            },
          ),
        );
      } catch {
        fail("WORLD_V2_READER_UPDATE_METADATA_FAILED");
      }
    },
    deployFunction = async () => {
      try {
        execFileSync(
          "supabase",
          ["functions", "deploy", UPDATE_SLUG, "--project-ref", UPDATE_PROJECT],
          {
            cwd: root,
            timeout: 90_000,
            maxBuffer: 1_048_576,
            stdio: ["ignore", "pipe", "pipe"],
          },
        );
      } catch {
        fail("WORLD_V2_READER_UPDATE_DEPLOY_UNKNOWN_STOP");
      }
    },
    request = fetch,
    expectedOldHash = OLD_FUNCTION_HASH, // synthetic mocks only; CLI exposes no override
  } = {},
) {
  await verifyUpdateGuard(context, { manifest, root });
  verifySource(worldRoot, manifest);
  await stageSource(); // both offline, before any production contact
  const counts = {
    metadata_list: 0,
    deploy: 0,
    public_get: 0,
    public_options: 0,
    key_acquisition: 0,
    storage_write: 0,
    database: 0,
  };
  const receipt = {
    authorization_id: UPDATE_AUTHORIZATION_ID,
    main_sha: context.sha,
    fingerprint: await readerUpdateFingerprint(root),
    project_ref: UPDATE_PROJECT,
    function: UPDATE_SLUG,
    world_source_commit: manifest.world_source_commit,
    world_function_tree: manifest.world_function_tree,
    request_counts: counts,
    preimage_provenance: "CURRENT_SAME_RUN_NOT_HISTORICAL_IDENTITY_PROOF",
    storage_publication: "NOT_RUN",
    pages_configuration: "NOT_RUN",
  };
  let stage = "PREIMAGE";
  try {
    counts.metadata_list++;
    const preimage = updatePreimage(await listFunctions(), expectedOldHash);
    receipt.preimage_identity_sha256 = preimage.sha256;
    stage = "RECHECK";
    counts.metadata_list++;
    verifyUpdateRecheck(preimage, await listFunctions(), expectedOldHash);
    stage = "DEPLOY";
    counts.deploy++;
    await deployFunction();
    stage = "AFTER";
    counts.metadata_list++;
    receipt.function_evidence = verifyUpdateAfter(
      preimage,
      await listFunctions(),
      expectedOldHash,
    );
    stage = "TWO_ORIGIN_HTTP";
    receipt.routes = [];
    for (const origin of UPDATE_ORIGINS) {
      counts.public_get++;
      const get = await request(ROUTE_URL, {
        method: "GET",
        headers: { Origin: origin },
        redirect: "error",
        credentials: "omit",
        signal: AbortSignal.timeout(10_000),
      });
      if (get.redirected || get.status !== 200) {
        await get.body?.cancel();
        fail("WORLD_V2_READER_UPDATE_ROUTE_INVALID");
      }
      if (
        get.headers.get("access-control-allow-origin") !== origin ||
        (get.headers.has("access-control-allow-credentials") &&
          get.headers.get("access-control-allow-credentials") !== "false")
      ) {
        await get.body?.cancel();
        fail("WORLD_V2_READER_UPDATE_CORS_INVALID");
      }
      const body = await boundedRouteJson(get);
      counts.public_options++;
      const options = await request(ROUTE_URL, {
        method: "OPTIONS",
        headers: {
          Origin: origin,
          "Access-Control-Request-Method": "GET",
          "Access-Control-Request-Headers": "Accept",
        },
        redirect: "error",
        credentials: "omit",
        signal: AbortSignal.timeout(10_000),
      });
      await options.body?.cancel();
      if (options.redirected || options.status !== 204)
        fail("WORLD_V2_READER_UPDATE_ROUTE_INVALID");
      receipt.routes.push(verifyUpdateOrigin(get, body, options, origin));
    }
    return { ...receipt, status: "READER_CORS_UPDATE_TWO_ORIGINS_VERIFIED" };
  } catch (error) {
    return {
      ...receipt,
      status:
        counts.deploy > 0
          ? "READER_UPDATE_OUTCOME_UNKNOWN_STOP_NO_RETRY"
          : "READER_UPDATE_BLOCKED_STOP_NO_RETRY",
      failed_stage: stage,
      code: codes.has(error?.message)
        ? error.message
        : "WORLD_V2_READER_UPDATE_STEP_FAILED",
      remote_update_may_have_occurred: counts.deploy > 0,
    };
  }
}
function environmentContext() {
  return {
    repository: process.env.GITHUB_REPOSITORY,
    ref: process.env.GITHUB_REF,
    sha: process.env.GITHUB_SHA,
    runAttempt: process.env.GITHUB_RUN_ATTEMPT,
    projectRef: process.env.SUPABASE_PROJECT_REF,
    managementToken: process.env.SUPABASE_ACCESS_TOKEN,
    authorizationId: process.env.WORLD_V2_READER_UPDATE_AUTHORIZATION_ID,
    confirmation: process.env.WORLD_V2_READER_UPDATE_CONFIRMATION,
    lock: process.env.WORLD_V2_READER_UPDATE_LOCK,
  };
}
async function main() {
  const [command, worldRoot, output, ...extra] = process.argv.slice(2);
  if (command === "fingerprint" && !worldRoot)
    process.stdout.write((await readerUpdateFingerprint()) + "\n");
  else if (command === "guard" && !worldRoot)
    await verifyUpdateGuard(environmentContext());
  else if (command === "source-sha" && !worldRoot) {
    verifyUpdateBinding(binding);
    process.stdout.write(binding.world_source_commit + "\n");
  } else if (
    command === "update-once" &&
    worldRoot &&
    output &&
    extra.length === 0
  ) {
    await verifyUpdateGuard(environmentContext());
    try {
      await access(output);
      fail("WORLD_V2_READER_UPDATE_RECEIPT_EXISTS");
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    const receipt = await runReaderUpdate(environmentContext(), worldRoot);
    await writeFile(output, JSON.stringify(receipt, null, 2) + "\n", {
      flag: "wx",
      mode: 0o600,
    });
    if (receipt.status !== "READER_CORS_UPDATE_TWO_ORIGINS_VERIFIED")
      process.exitCode = 1;
  } else fail("WORLD_V2_READER_UPDATE_COMMAND_INVALID");
}
if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
)
  main().catch(() => {
    process.stderr.write("WORLD_V2_READER_UPDATE_STOP_NO_RETRY\n");
    process.exitCode = 1;
  });
