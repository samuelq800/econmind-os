/** Local immutable Git-byte inventory. No SQL execution or provider access. */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, realpath, lstat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
const policyPath = fileURLToPath(
  new URL("./world-v2-postwar-proposal-policy.json", import.meta.url),
);
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const POLICY_SHA256 =
  "912f35816062d4d026ff2d638bd97a3d7fb5b042577479a3c188f2f69cef8ee6";
export function requireImmutableProposalCandidateSha(candidateSha) {
  if (!/^[a-f0-9]{40}$/u.test(candidateSha ?? "") || /^0+$/u.test(candidateSha))
    throw Error("EXPLICIT_FULL_IMMUTABLE_CANDIDATE_SHA_REQUIRED");
}
export async function loadPostwarExpandedProposalPolicy() {
  const bytes = await readFile(policyPath);
  if (sha(bytes) !== POLICY_SHA256)
    throw Error("FIXED_EXPANDED_POLICY_BYTES_REQUIRED");
  const policy = JSON.parse(bytes);
  if (
    policy.sourceCommit !== null ||
    policy.projectRef !== "vimksjrhaxdpnkvgsavz" ||
    policy.sourceRemote !==
      "https://github.com/samuelq800/econmind-os-world-simulation.git" ||
    policy.installationAllowed !== false ||
    policy.productionReviewVerified !== false ||
    policy.finalCandidateSelected !== false ||
    policy.proposals.length !== 31
  )
    throw Error("UNAPPROVED_EXPLICIT_CANDIDATE_POLICY_REQUIRED");
  const prior = new Set();
  for (const item of policy.proposals) {
    if (
      item.path !== `database/proposals/${item.id}.sql` ||
      item.registration !== "UNREGISTERED_SOURCE_PROPOSAL" ||
      item.productionApproval !== "NOT_GRANTED" ||
      prior.has(item.id) ||
      item.dependencies.some((d) => !prior.has(d))
    )
      throw Error("FIXED_PROPOSAL_DEPENDENCY_ORDER_INVALID");
    prior.add(item.id);
  }
  validateExpandedProposalRoleDependencies(policy);
  return { policy, policySha256: sha(bytes) };
}
/** Provider identity and dependency closure are fixed review metadata only.
 * A valid mapping does not enroll roles or approve the candidate SQL. */
export function validateExpandedProposalRoleDependencies(policy) {
  const providers = new Map();
  for (const item of policy.proposals)
    for (const role of item.createdRoles) {
      if (providers.has(role)) throw Error("AMBIGUOUS_SOURCE_ROLE_PROVIDER");
      providers.set(role, item.id);
    }
  const seen = new Map();
  for (const item of policy.proposals) {
    const closure = new Set(item.dependencies);
    for (const dependency of item.dependencies) {
      const parent = seen.get(dependency);
      if (!parent) throw Error("SOURCE_ROLE_DEPENDENCY_ORDER_INVALID");
      for (const ancestor of parent) closure.add(ancestor);
    }
    for (const [role, provider] of Object.entries(item.sourceRoleDeps ?? {})) {
      if (provider === "EXTERNAL_REVIEWED_NOLOGIN_GROUP_NOT_PROVISIONED") {
        if (
          item.id !== "postwar-runtime-source-read-policy" ||
          role !== policy.offlineRawGroup.name
        )
          throw Error("UNREVIEWED_EXTERNAL_SOURCE_ROLE");
      } else if (
        providers.get(role) !== provider ||
        (provider !== item.id && !closure.has(provider))
      )
        throw Error("SOURCE_ROLE_PROVIDER_DEPENDENCY_REQUIRED");
    }
    const required = [...item.createdRoles, ...item.reusedRoles];
    if (
      required.some(
        (role) => !Object.hasOwn(item.sourceRoleDeps ?? {}, role),
      ) ||
      item.productionReviewVerified !== false
    )
      throw Error("EXPLICIT_SOURCE_ROLE_DEPENDENCIES_REQUIRED");
    seen.set(item.id, closure);
  }
}
/** Fixed scalar signatures for the nine added proposals. This is declaration
 * comparison, not a general SQL parser or a substitute for catalog readback. */
export function inspectPostwarFunctionContracts(item, bytes) {
  if (item.definedFunctionSignatures === undefined) return;
  const sql = bytes.toString("utf8");
  const actual = [];
  for (const match of sql.matchAll(
    /create\s+(?:or\s+replace\s+)?function\s+world_v2\.([a-z_0-9]+)\s*\((.*?)\)\s*returns/gisu,
  )) {
    const [, name, argumentsText] = match;
    const types =
      argumentsText.trim() === ""
        ? []
        : argumentsText.split(",").map((argument) => {
            const fields = argument.trim().split(/\s+/u);
            if (!/^(?:text|jsonb|bigint|integer|uuid)$/u.test(fields[1] ?? ""))
              throw Error("FIXED_SCALAR_FUNCTION_SIGNATURE_REQUIRED");
            return fields[1];
          });
    const signature = `world_v2.${name}(${types.join(",")})`;
    actual.push(signature);
    const expected = item.functionContracts?.find(
      (entry) => entry.qualifiedSignature === signature,
    );
    if (!expected) throw Error("PROPOSAL_FUNCTION_SIGNATURE_CHANGED");
    const identity = signature.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
    const owner = sql.match(
      new RegExp(
        `alter\\s+function\\s+${identity}\\s*owner\\s+to\\s+([a-z_0-9]+)`,
        "iu",
      ),
    );
    const declarationTail = sql.slice(match.index + match[0].length);
    const bodyDelimiter = /\bas\s+\$(?:[a-z_][a-z_0-9]*)?\$/iu.exec(
      declarationTail,
    );
    if (!bodyDelimiter) throw Error("FIXED_FUNCTION_DECLARATION_REQUIRED");
    const headerEnd = match.index + match[0].length + bodyDelimiter.index;
    const header = sql.slice(match.index, headerEnd);
    if (
      owner?.[1] !== expected.owner ||
      /\bsecurity\s+definer\b/iu.test(header) !== expected.securityDefiner ||
      !/set\s+search_path\s*=\s*pg_catalog\b/iu.test(header)
    )
      throw Error("PROPOSAL_FUNCTION_OWNER_OR_EXECUTION_MODE_CHANGED");
  }
  if (
    JSON.stringify(actual.sort()) !==
      JSON.stringify([...item.definedFunctionSignatures].sort()) ||
    actual.length !== item.functionContracts?.length
  )
    throw Error("PROPOSAL_FUNCTION_SIGNATURE_CHANGED");
}
// This is a fixed declaration comparison for the reviewed 0009 forward-fix,
// not a PostgreSQL parser or a pg_get_functiondef hash normalizer.
function financialPostingDeclaration(bytes) {
  const sql = bytes.toString("utf8");
  const header =
    "create or replace function world_v2.validate_financial_posting_payload(payload jsonb, row_value world_v2.financial_posting_batch)";
  const start = sql.indexOf(header);
  const end = sql.indexOf("\n$$;", start);
  if (start < 0 || end < start || sql.lastIndexOf(header) !== start)
    throw Error("FIXED_FINANCIAL_POSTING_DECLARATION_REQUIRED");
  return sql.slice(start, end + 4);
}
function financialPostingReplacement(item, bytes) {
  const entries = item.namedFunctionReplacements;
  if (
    item.id !== "financial-posting-decimal-validation" ||
    entries?.length !== 1 ||
    entries[0].qualifiedSignature !==
      "world_v2.validate_financial_posting_payload(jsonb,world_v2.financial_posting_batch)" ||
    entries[0].baselineMigrationId !== "0009_world_v2_posting_payload_integrity"
  )
    throw Error("FIXED_BASELINE_FUNCTION_REPLACEMENT_REQUIRED");
  const replacement = entries[0];
  if (
    sha(bytes) !== replacement.successorSqlSha256 ||
    sha(financialPostingDeclaration(bytes)) !==
      replacement.successorDeclarationSourceSha256
  )
    throw Error("NAMED_FUNCTION_REPLACEMENT_SOURCE_BYTES_CHANGED");
  return replacement;
}
export function validatePostwarFinancialPostingReplacement(
  item,
  bytes,
  baselineBytes,
) {
  const replacement = financialPostingReplacement(item, bytes);
  const before = financialPostingDeclaration(baselineBytes);
  const after = financialPostingDeclaration(bytes);
  const previousSeparator = String.fromCharCode(92, 92, 46);
  if (
    sha(baselineBytes) !== replacement.baselineArtifactSha256 ||
    sha(before) !== replacement.predecessorDeclarationSourceSha256
  )
    throw Error("NAMED_FUNCTION_BASELINE_PREDECESSOR_CHANGED");
  if (
    before.split(previousSeparator).length !== 2 ||
    before.replace(previousSeparator, "[.]") !== after
  )
    throw Error("EXACT_DECIMAL_REGEX_FORWARD_FIX_REQUIRED");
}
/** Extract catalog names only, never interpret proposal SQL as executable input.
 * Metadata extraction is not approval or an exhaustive SQL/security parser. */
export function inspectExpandedProposalBytes(item, bytes) {
  if (item.namedFunctionReplacements !== undefined)
    financialPostingReplacement(item, bytes);
  inspectPostwarFunctionContracts(item, bytes);
  const sql = bytes.toString("utf8");
  const names = (pattern) =>
    [...new Set([...sql.matchAll(pattern)].map((m) => m[1]))].sort();
  const equal = (actual, expected) =>
    JSON.stringify(actual) === JSON.stringify([...new Set(expected)].sort());
  const relations = names(/create\s+table\s+world_v2\.([a-z_0-9]+)/giu);
  const functions = names(
    /create\s+(?:or\s+replace\s+)?function\s+world_v2\.([a-z_0-9]+)/giu,
  );
  const renamed = names(
    /alter\s+function\s+world_v2\.[a-z_0-9]+\([^;]*?\)\s*rename\s+to\s+([a-z_0-9]+)/giu,
  );
  const literalPolicies = names(/create\s+policy\s+([a-z_0-9]+)/giu);
  if (
    item.literalCreatedPolicies !== undefined &&
    !equal(literalPolicies, item.literalCreatedPolicies)
  )
    throw Error("PROPOSAL_LITERAL_POLICY_ALLOWLIST_CHANGED");
  const declaredRoles = names(/create\s+role\s+("?[a-z_][a-z_0-9]*"?)/giu).map(
    (role) => role.replaceAll('"', ""),
  );
  for (const loop of sql.matchAll(
    /foreach\s+\w+\s+in\s+array\s+array\[([^\]]*)\]loop([\s\S]*?)end\s*loop/giu,
  )) {
    if (/create\s+role\s+%I/iu.test(loop[2]))
      declaredRoles.push(
        ...[...loop[1].matchAll(/'([a-z_][a-z_0-9]*)'/giu)].map((m) => m[1]),
      );
  }
  const referencedRoles = names(/\b(world_v2_[a-z_0-9]+)\b/giu);
  const roleAllowlist = [
    ...Object.keys(item.sourceRoleDeps ?? {}),
    ...(item.deniedRoleNames ?? []),
    ...(item.roleNamePrefixContext ?? []),
  ];
  if (!equal(referencedRoles, roleAllowlist))
    throw Error("PROPOSAL_SOURCE_ROLE_DEPENDENCY_ALLOWLIST_CHANGED");
  if (
    !equal(relations, item.createdRelations) ||
    !equal(functions, item.definedFunctions) ||
    !equal(renamed, item.renamedFunctions)
  )
    throw Error("PROPOSAL_OBJECT_ALLOWLIST_CHANGED_REVIEW_POLICY_REQUIRED");
  if (!equal([...new Set(declaredRoles)].sort(), item.createdRoles))
    throw Error("PROPOSAL_ROLE_ALLOWLIST_CHANGED_REVIEW_POLICY_REQUIRED");
  if (
    item.createdRoles.length &&
    (!/nologin\s+nosuperuser\s+nobypassrls\s+nocreatedb\s+nocreaterole\s+noreplication/iu.test(
      sql,
    ) ||
      item.createdRoles.some((role) => !sql.includes(role)))
  )
    throw Error("DECLARED_FIXED_NOLOGIN_ROLE_REQUIREMENTS_MISSING");
  return {
    ...item,
    referencedRoleNames: referencedRoles,
    sha256: sha(bytes),
    bytes: bytes.length,
    sha256Meaning: "OBSERVED_IMMUTABLE_CANDIDATE_BYTES_NOT_APPROVAL",
    definedFunctions: [...new Set([...functions, ...renamed])].sort(),
  };
}
export async function loadPostwarExpandedProposalCandidate(
  sourceRoot,
  candidateSha,
) {
  requireImmutableProposalCandidateSha(candidateSha);
  if (!path.isAbsolute(sourceRoot))
    throw Error("ABSOLUTE_WORLD_SOURCE_REQUIRED");
  const { policy, policySha256 } = await loadPostwarExpandedProposalPolicy();
  const git = (args) =>
    execFileSync("git", ["-C", sourceRoot, ...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  if (
    git(["rev-parse", "HEAD"]) !== candidateSha ||
    git(["remote", "get-url", "origin"]) !== policy.sourceRemote ||
    git(["status", "--porcelain=v1", "--untracked-files=all"])
  )
    throw Error("EXACT_CLEAN_WORLD_CANDIDATE_REQUIRED");
  const read = async (relative) => {
    const target = path.join(sourceRoot, relative);
    if (!(await lstat(target)).isFile() || (await realpath(target)) !== target)
      throw Error("REGULAR_SOURCE_ARTIFACT_REQUIRED");
    return readFile(target);
  };
  const manifestBytes = await read("database/migrations/manifest.json");
  const manifest = JSON.parse(manifestBytes);
  if (
    sha(manifestBytes) !== policy.registeredManifestSha256 ||
    manifest.migrations.length !== policy.registeredMigrationCount ||
    manifest.production_publisher !== "main-site-release-chain"
  )
    throw Error("REGISTERED_BASELINE_NOT_UNCHANGED");
  for (const m of manifest.migrations)
    if (sha(await read(m.path)) !== m.sha256)
      throw Error("PINNED_BASELINE_ARTIFACT_BYTES_CHANGED");
  const proposals = [];
  for (const item of policy.proposals) {
    if (
      manifest.migrations.some((m) => m.path === item.path) ||
      item.baselineDependencies.some(
        (id) => !manifest.migrations.some((m) => m.migration_id === id),
      )
    )
      throw Error("UNREGISTERED_PROPOSAL_OR_BASELINE_DEPENDENCY_INVALID");
    const bytes = await read(item.path);
    if (item.namedFunctionReplacements !== undefined) {
      const replacement = financialPostingReplacement(item, bytes);
      const predecessor = manifest.migrations.find(
        (m) => m.migration_id === replacement.baselineMigrationId,
      );
      if (
        !item.baselineDependencies.includes(replacement.baselineMigrationId) ||
        predecessor?.path !== replacement.baselinePath ||
        predecessor?.sha256 !== replacement.baselineArtifactSha256
      )
        throw Error(
          "EXACT_REGISTERED_BASELINE_REPLACEMENT_DEPENDENCY_REQUIRED",
        );
      validatePostwarFinancialPostingReplacement(
        item,
        bytes,
        await read(predecessor.path),
      );
    }
    proposals.push(inspectExpandedProposalBytes(item, bytes));
  }
  // Recheck identity/cleanliness after every byte was observed.
  if (
    git(["rev-parse", "HEAD"]) !== candidateSha ||
    git(["status", "--porcelain=v1", "--untracked-files=all"])
  )
    throw Error("CANDIDATE_CHANGED_DURING_INVENTORY");
  return {
    manifest,
    pins: {
      ...policy,
      schemaVersion: "WORLD_V2_POSTWAR_EXPANDED_CANDIDATE_HANDOFF_V1",
      candidateMode: "EXPLICIT_IMMUTABLE_SHA_UNAPPROVED",
      sourceCommit: candidateSha,
      sourceTree: git(["rev-parse", "HEAD^{tree}"]),
      manifestPath: "database/migrations/manifest.json",
      manifestSha256: sha(manifestBytes),
      expandedPolicySha256: policySha256,
      proposals,
      externalRolePrerequisite: policy.offlineRawGroup,
      publicationOwner: "main-site-release-chain",
      concurrencyGroup: "supabase-production",
    },
  };
}
