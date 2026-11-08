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
  "336371dd4d9de3fef973ca85673098ae2e0887dcbdfb4fc514190b0e71796635";
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
    policy.proposals.length !== 80
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
/** Fixed scalar signatures for explicitly reviewed proposal declarations. This is declaration
 * comparison, not a general SQL parser or a substitute for catalog readback. */
export function inspectPostwarFunctionContracts(item, bytes) {
  if (item.definedFunctionSignatures === undefined) return;
  const sql = bytes.toString("utf8");
  const actual = [];
  for (const match of sql.matchAll(
    /create\s+(?:or\s+replace\s+)?function\s+world_v2\.([a-z_0-9]+)\s*\((.*?)\)\s*returns/gisu,
  )) {
    const [, name, argumentsText] = match;
    if (
      item.id === "postwar-industry-opening-production-validation" &&
      name === "validate_inventory_production_payload"
    ) {
      if (
        argumentsText.trim() !==
        "payload jsonb, row_value world_v2.inventory_posting"
      )
        throw Error("FIXED_INDUSTRY_VALIDATOR_SIGNATURE_REQUIRED");
      continue; // separately pinned exact baseline replacement, not a generic scalar helper
    }
    const types =
      argumentsText.trim() === ""
        ? []
        : argumentsText.split(",").map((argument) => {
            const fields = argument.trim().split(/\s+/u);
            if (
              !/^(?:text|jsonb|bigint|integer|uuid|timestamptz|numeric)$/u.test(
                fields[1] ?? "",
              )
            )
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
    if (
      [
        "postwar-industry-power-service-source",
        "postwar-industry-power-service-current",
      ].includes(item.id)
    ) {
      const grants = [
        ...sql.matchAll(
          new RegExp(
            `grant\\s+(execute|all)\\s+on\\s+function\\s+${identity}\\s*to\\s+([^;]+);`,
            "giu",
          ),
        ),
      ];
      const roles = grants
        .flatMap((entry) => entry[2].split(",").map((role) => role.trim()))
        .sort();
      if (
        expected.publicExecute !== false ||
        !new RegExp(
          `revoke\\s+all\\s+on\\s+function\\s+${identity}\\s*from\\s+public\\s*;`,
          "iu",
        ).test(sql) ||
        grants.some((entry) => entry[1].toLowerCase() !== "execute") ||
        JSON.stringify(roles) !==
          JSON.stringify([...expected.executeRoles].sort())
      )
        throw Error("POWER_SERVICE_FIXED_EXECUTE_DECLARATIONS_CHANGED");
    }
  }
  if (
    JSON.stringify(actual.sort()) !==
      JSON.stringify([...item.definedFunctionSignatures].sort()) ||
    actual.length !== item.functionContracts?.length
  )
    throw Error("PROPOSAL_FUNCTION_SIGNATURE_CHANGED");
  if (item.renamedFunctionContracts !== undefined) {
    const alias = item.renamedFunctionContracts[0];
    const predecessor = item.functionContracts.find(
      (c) =>
        c.qualifiedSignature ===
        "world_v2.read_postwar_captain_current_page(text,integer,integer,text)",
    );
    if (
      item.id !== "postwar-captain-h0-current" ||
      item.renamedFunctionContracts.length !== 1 ||
      alias.qualifiedSignature !==
        "world_v2.read_postwar_captain_current_page_before_h0_v1(text,integer,integer,text)" ||
      alias.owner !== predecessor?.owner ||
      alias.securityDefiner !== predecessor.securityDefiner ||
      alias.searchPath !== predecessor.searchPath ||
      alias.publicExecute !== false ||
      alias.executeRoles.length !== 0 ||
      !/alter\s+function\s+world_v2\.read_postwar_captain_current_page\(text,integer,integer,text\)\s*rename\s+to\s+read_postwar_captain_current_page_before_h0_v1\s*;/iu.test(
        sql,
      ) ||
      !/revoke\s+all\s+on\s+function\s+world_v2\.read_postwar_captain_current_page_before_h0_v1\(text,integer,integer,text\)\s*from\s+public,world_v2_postwar_projection_reader\s*;/iu.test(
        sql,
      ) ||
      /grant\s+(?:all|execute)[^;]*read_postwar_captain_current_page_before_h0_v1/iu.test(
        sql,
      )
    )
      throw Error("CAPTAIN_H0_PRIVATE_RENAMED_DISPATCHER_CONTRACT_CHANGED");
  }
}
/** Fixed column ACL review for the rent definer's nested baseline RLS reads.
 * This compares declarations, never grants access or replaces catalog evidence. */
export function inspectPostwarDefinerColumnReads(item, bytes) {
  if (item.definerColumnReadContracts === undefined) return [];
  if (
    item.id !== "postwar-beneficial-housing-rent-custody" ||
    item.definerColumnReadContracts.length !== 2
  )
    throw Error("FIXED_RENT_METADATA_COLUMN_CONTRACT_REQUIRED");
  const sql = bytes.toString("utf8");
  return item.definerColumnReadContracts.map((contract) => {
    const grants = [...sql.matchAll(/\bgrant\s+select\b[^;]*;/giu)]
      .map((match) => match[0])
      .filter((statement) => statement.includes(contract.qualifiedRelation));
    const match = grants[0]?.match(
      /^grant\s+select\s*\(([^)]*)\)\s*on\s+(world_v2\.[a-z_0-9]+)\s+to\s+([a-z_0-9]+)\s*;/iu,
    );
    const columns = match?.[1]
      .split(",")
      .map((name) => name.trim())
      .sort();
    if (
      grants.length !== 1 ||
      !match ||
      match[2] !== contract.qualifiedRelation ||
      match[3] !== contract.role ||
      JSON.stringify(columns) !== JSON.stringify([...contract.columns].sort())
    )
      throw Error("RENT_DEFINER_EXACT_METADATA_COLUMN_SELECT_REQUIRED");
    return {
      ...contract,
      columns,
      declarationOnly: true,
      productionApplied: false,
    };
  });
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
function industryOpeningDeclaration(bytes) {
  const sql = bytes.toString("utf8");
  const header =
    /create(?: or replace)? function world_v2\.validate_inventory_production_payload\(payload jsonb, row_value world_v2\.inventory_posting\)/u;
  const match = header.exec(sql);
  const end = match ? sql.indexOf("\n$$;", match.index) : -1;
  if (
    !match ||
    end < match.index ||
    header.test(sql.slice(match.index + match[0].length))
  )
    throw Error("FIXED_INDUSTRY_VALIDATOR_DECLARATION_REQUIRED");
  return sql.slice(match.index, end + 4);
}
function industryOpeningReplacement(item, bytes) {
  const entries = item.namedFunctionReplacements;
  if (
    item.id !== "postwar-industry-opening-production-validation" ||
    entries?.length !== 1 ||
    entries[0].qualifiedSignature !==
      "world_v2.validate_inventory_production_payload(jsonb,world_v2.inventory_posting)" ||
    entries[0].baselineMigrationId !==
      "0023_world_v2_production_consumption_posting"
  )
    throw Error("FIXED_INDUSTRY_BASELINE_REPLACEMENT_REQUIRED");
  const entry = entries[0],
    declaration = industryOpeningDeclaration(bytes);
  if (
    sha(bytes) !== entry.successorSqlSha256 ||
    sha(declaration) !== entry.successorDeclarationSourceSha256
  )
    throw Error("NAMED_FUNCTION_REPLACEMENT_SOURCE_BYTES_CHANGED");
  // CREATE OR REPLACE keeps the existing owner and ACL; no replacement can
  // silently reassign this immutable-baseline signature or switch it to definer.
  const header = declaration.slice(0, declaration.indexOf("as $$"));
  if (
    /security\s+definer/iu.test(header) ||
    !/set\s+search_path\s*=\s*pg_catalog/iu.test(header) ||
    /(?:alter\s+function|grant|revoke)[^;]*world_v2\.validate_inventory_production_payload/iu.test(
      bytes.toString("utf8"),
    )
  )
    throw Error("INDUSTRY_BASELINE_OWNER_ACL_AND_INVOKER_MUST_BE_PRESERVED");
  return entry;
}
export function validatePostwarIndustryOpeningReplacement(
  item,
  bytes,
  baselineBytes,
) {
  const entry = industryOpeningReplacement(item, bytes);
  if (
    sha(baselineBytes) !== entry.baselineArtifactSha256 ||
    sha(industryOpeningDeclaration(baselineBytes)) !==
      entry.predecessorDeclarationSourceSha256
  )
    throw Error("NAMED_FUNCTION_BASELINE_PREDECESSOR_CHANGED");
  return entry;
}
function fixedNamedBaselineReplacement(item, bytes) {
  return item.id === "postwar-industry-opening-production-validation"
    ? industryOpeningReplacement(item, bytes)
    : financialPostingReplacement(item, bytes);
}
/** Only the named adjacent Trade derived-table CHECK extension is declared.
 * This is source review metadata, never a general DROP or installation permit. */
export function inspectPostwarTradeConstraintExtension(item, bytes) {
  if (item.namedConstraintExtension === undefined) return null;
  const expected = {
    qualifiedRelation: "world_v2.postwar_paged_current_document",
    constraint: "postwar_paged_current_document_office_id_check",
    previousOffices: ["FINANCE", "CENTRAL_BANK", "SOCIAL", "CAPTAIN"],
    nextOffices: ["FINANCE", "CENTRAL_BANK", "SOCIAL", "CAPTAIN", "TRADE"],
    semantics:
      "EXACT_ADJACENT_DROP_AND_ADD_IN_ONE_SOURCE_TRANSACTION_NOT_GENERAL_DROP_APPROVAL",
  };
  if (
    item.id !== "postwar-trade-current-projection" ||
    JSON.stringify(item.namedConstraintExtension) !== JSON.stringify(expected)
  )
    throw Error("FIXED_TRADE_DERIVED_CHECK_EXTENSION_REQUIRED");
  const sql = bytes.toString("utf8");
  const pair =
    /alter\s+table\s+world_v2\.postwar_paged_current_document\s+drop\s+constraint\s+postwar_paged_current_document_office_id_check\s*;\s*alter\s+table\s+world_v2\.postwar_paged_current_document\s+add\s+constraint\s+postwar_paged_current_document_office_id_check\s+check\s*\(\s*office_id\s+in\s*\(\s*'FINANCE'\s*,\s*'CENTRAL_BANK'\s*,\s*'SOCIAL'\s*,\s*'CAPTAIN'\s*,\s*'TRADE'\s*\)\s*\)\s*;/giu;
  if (
    [...sql.matchAll(pair)].length !== 1 ||
    /\bdrop\b/iu.test(sql.replace(pair, ""))
  )
    throw Error("EXACT_ADJACENT_TRADE_CHECK_EXTENSION_REQUIRED");
  return { ...expected, declarationOnly: true, productionApplied: false };
}
/** The Captain UI helper remains private, immutable metadata, never approval. */
export function inspectPostwarCaptainAllocationOptions(item, bytes) {
  if (item.id !== "postwar-captain-current-derived-read") return;
  const sql = bytes.toString("utf8");
  const signature =
    "world_v2\\.postwar_captain_allocation_options\\(jsonb,text\\)";
  if (
    !/create\s+function\s+world_v2\.postwar_captain_allocation_options\(p_packet jsonb,p_country text\)returns jsonb\s+language plpgsql immutable set search_path=pg_catalog as \$\$/iu.test(
      sql,
    ) ||
    !new RegExp(
      `alter\\s+function\\s+${signature}owner\\s+to\\s+world_v2_postwar_projection_owner\\s*;`,
      "iu",
    ).test(sql) ||
    !new RegExp(
      `revoke\\s+all\\s+on\\s+function\\s+${signature}from\\s+public\\s*;`,
      "iu",
    ).test(sql) ||
    /grant\s+(?:execute|all)[^;]*world_v2\.postwar_captain_allocation_options/iu.test(
      sql,
    )
  )
    throw Error("CAPTAIN_ALLOCATION_PRIVATE_IMMUTABLE_HELPER_REQUIRED");
}
// One immutable repair source, not a generic dynamic-DDL registration surface.
export const COMPLETE_OPENING_INVENTORY_REPAIR_ID =
  "postwar-complete-opening-inventory-read-repair";
export const COMPLETE_OPENING_INVENTORY_REPAIR_SHA256 =
  "aa47ebbae894c4c9f0dbaff22a18757962a294e5fa18fb0fcea802ae8454cb37";
export const COMPLETE_OPENING_INVENTORY_ADAPTATIONS = Object.freeze(
  [
    [
      "world_v2.publish_postwar_office_projection(text,text,text,text,text,text,text,text)",
      "postwar-office-derived-read",
      ["world_v2_postwar_projection_publisher"],
    ],
    [
      "world_v2.read_postwar_office_projection_h0_page(text,text,text,integer,integer,text)",
      "postwar-social-current-derived-read",
      [],
    ],
    [
      "world_v2.read_postwar_physical_opening_facts_page(text,text,text,integer,integer,text)",
      "postwar-physical-opening-facts-read",
      ["world_v2_postwar_projection_reader"],
    ],
    [
      "world_v2.publish_postwar_inventory_provenance_v2(text,text,text,text,text,text)",
      "postwar-physical-inventory-provenance",
      ["world_v2_postwar_projection_publisher"],
    ],
    [
      "world_v2.read_postwar_inventory_provenance_v2_page(text,text,text,integer,integer,text)",
      "postwar-physical-inventory-provenance",
      ["world_v2_postwar_projection_reader"],
    ],
    [
      "world_v2.postwar_write_trade_current_document(text,text,text,text,text,bigint,bigint,jsonb,jsonb,jsonb)",
      "postwar-trade-current-projection",
      [],
    ],
    [
      "world_v2.publish_postwar_paged_trade_current(text,text,text)",
      "postwar-trade-current-projection",
      ["world_v2_postwar_projection_publisher"],
    ],
    [
      "world_v2.read_postwar_trade_current_page(text,text,integer,integer,text)",
      "postwar-trade-current-projection",
      ["world_v2_postwar_projection_reader"],
    ],
    [
      "world_v2.read_postwar_narrow_trade_current_source(text,text,text,text,uuid,text,text)",
      "postwar-narrow-trade-current-source",
      ["world_v2_postwar_narrow_trade_source"],
    ],
    [
      "world_v2.read_postwar_narrow_trade_automatic_source(text,text,text,timestamptz,text)",
      "postwar-narrow-trade-automatic-source",
      ["world_v2_postwar_narrow_trade_source"],
    ],
    [
      "world_v2.read_postwar_narrow_trade_current_paged_scope(text,text,text,text,uuid,text,text)",
      "postwar-narrow-trade-paged-source",
      ["world_v2_postwar_narrow_trade_source"],
    ],
    [
      "world_v2.read_postwar_narrow_trade_automatic_paged_scope(text,text,text,timestamptz,text)",
      "postwar-narrow-trade-paged-source",
      ["world_v2_postwar_narrow_trade_source"],
    ],
    [
      "world_v2.postwar_projection_current_inventory_balance(text,jsonb,bigint)",
      "postwar-mixed-goods-omo-current-effects",
      [],
    ],
  ].map(([signature, predecessor, executeRoles]) =>
    Object.freeze({
      signature,
      predecessor,
      executeRoles: Object.freeze(executeRoles),
    }),
  ),
);
export function inspectCompleteOpeningInventoryRepair(item, bytes) {
  if (item.id !== COMPLETE_OPENING_INVENTORY_REPAIR_ID) {
    if (item.fixedFunctionAdaptations !== undefined)
      throw Error("FIXED_COMPLETE_INVENTORY_REPAIR_ONLY");
    return;
  }
  if (
    sha(bytes) !== COMPLETE_OPENING_INVENTORY_REPAIR_SHA256 ||
    item.fixedAdaptationSqlSha256 !== COMPLETE_OPENING_INVENTORY_REPAIR_SHA256
  )
    throw Error("FIXED_COMPLETE_INVENTORY_REPAIR_BYTES_REQUIRED");
  const blocks = [
    ...bytes
      .toString("utf8")
      .matchAll(/-- Fixed adaptation: ([^\n]+)\n([\s\S]*?)end;\$adapt\$;/gu),
  ];
  if (blocks.length !== 13 || item.fixedFunctionAdaptations?.length !== 13)
    throw Error("FIXED_COMPLETE_INVENTORY_ADAPTATIONS_REQUIRED");
  for (const [
    i,
    expected,
  ] of COMPLETE_OPENING_INVENTORY_ADAPTATIONS.entries()) {
    const [, signature, block] = blocks[i];
    const actual = item.fixedFunctionAdaptations[i],
      contract = actual?.contract;
    const owner = signature.startsWith("world_v2.read_postwar_narrow_trade_")
      ? "world_v2_postwar_narrow_trade_current_owner"
      : "world_v2_postwar_projection_owner";
    const hashes = [...block.matchAll(/'([a-f0-9]{64})'/gu)].map((m) => m[1]);
    const body = block.match(
      /replacement:=\$newbody\$([\s\S]*?)\$newbody\$;/u,
    )?.[1];
    if (
      signature !== expected.signature ||
      actual.qualifiedSignature !== expected.signature ||
      actual.predecessor !== expected.predecessor ||
      !item.dependencies.includes(expected.predecessor) ||
      hashes.length !== 2 ||
      actual.predecessorProsrcSha256 !== hashes[0] ||
      actual.successorProsrcSha256 !== hashes[1] ||
      body === undefined ||
      sha(Buffer.from(body)) !== hashes[1] ||
      contract?.qualifiedSignature !== signature ||
      contract.owner !== owner ||
      contract.securityDefiner !== true ||
      contract.searchPath !== "pg_catalog" ||
      contract.publicExecute !== false ||
      JSON.stringify([...(contract.executeRoles ?? [])].sort()) !==
        JSON.stringify([...expected.executeRoles].sort())
    )
      throw Error("FIXED_COMPLETE_INVENTORY_ADAPTATION_CONTRACT_CHANGED");
  }
}

export function inspectExpandedProposalBytes(item, bytes) {
  inspectCompleteOpeningInventoryRepair(item, bytes);
  inspectPostwarCaptainAllocationOptions(item, bytes);
  inspectPostwarTradeConstraintExtension(item, bytes);
  if (item.namedFunctionReplacements !== undefined)
    fixedNamedBaselineReplacement(item, bytes);
  inspectPostwarFunctionContracts(item, bytes);
  const definerColumnReadContracts = inspectPostwarDefinerColumnReads(
    item,
    bytes,
  );
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
    ...(definerColumnReadContracts.length
      ? { definerColumnReadContracts }
      : {}),
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
      const replacement = fixedNamedBaselineReplacement(item, bytes);
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
      (item.id === "postwar-industry-opening-production-validation"
        ? validatePostwarIndustryOpeningReplacement
        : validatePostwarFinancialPostingReplacement)(
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
