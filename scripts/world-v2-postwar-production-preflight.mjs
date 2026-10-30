/** Render-only catalog handoff. No network, credential, database driver or DDL execution. */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile, writeFile, mkdir, lstat, realpath } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { WORLD_V2_RELEASE_PROJECT_REF } from "./render-world-v2-release-query.mjs";
import { loadPostwarExpandedProposalCandidate } from "./world-v2-postwar-proposal-candidate.mjs";

const bindingPath = fileURLToPath(
  new URL(
    "./world-v2-postwar-production-preflight-binding.json",
    import.meta.url,
  ),
);
// Review this exact binding together with this renderer; no caller SQL/target.
const BINDING_SHA256 =
  "31612afab3d6538ca95421cefa15d59443839f52e2fbb9498ff79ae8665f136f";
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
const literal = (text) => "'" + text.replaceAll("'", "''") + "'";
const baselineRelations = [
  "schema_release",
  "world_head",
  "current_commit_authorization",
  "projection_entitlement",
  "opening_seed",
  "authoritative_event",
  "command_submission",
  "command_receipt",
  "financial_posting_batch",
  "inventory_posting",
];
const baselineFunctions = ["reject_authoritative_history_mutation"];
async function binding() {
  const bytes = await readFile(bindingPath);
  if (digest(bytes) !== BINDING_SHA256)
    throw Error("FIXED_HANDOFF_BINDING_BYTES_REQUIRED");
  const value = JSON.parse(bytes);
  if (
    value.projectRef !== WORLD_V2_RELEASE_PROJECT_REF ||
    value.installationAllowed !== false
  )
    throw Error("FIXED_TARGET_AND_NONEXECUTABLE_HANDOFF_REQUIRED");
  return value;
}
/** Only pg_catalog relations are read. Application function bodies/rows, JWTs,
 * role settings/passwords and policy expressions are never returned. */
export async function renderPostwarCatalogQuery() {
  const pins = await binding();
  return catalogQueryForPins(pins);
}
/** Expected function ACLs are review metadata, never GRANT instructions. */
export function postwarCatalogFunctionContracts(proposals) {
  const contracts = new Map();
  for (const proposal of proposals.filter(
    (p) => !p.disposition.startsWith("EXCLUDED_"),
  )) {
    for (const contract of proposal.functionContracts ?? []) {
      if (contracts.has(contract.qualifiedSignature))
        throw Error("DUPLICATE_EXACT_FUNCTION_CATALOG_CONTRACT");
      contracts.set(contract.qualifiedSignature, {
        ...contract,
        proposalId: proposal.id,
      });
    }
  }
  return [...contracts.values()].sort((a, b) =>
    a.qualifiedSignature.localeCompare(b.qualifiedSignature),
  );
}
function catalogQueryForPins(pins) {
  const relevant = pins.proposals.filter(
    (proposal) => !proposal.disposition.startsWith("EXCLUDED_"),
  );
  const exactFunctionContracts = postwarCatalogFunctionContracts(relevant);
  const relationNames = [
    ...new Set([
      ...baselineRelations,
      ...relevant.flatMap((proposal) => proposal.createdRelations),
    ]),
  ].sort();
  const functionNames = [
    ...new Set([
      ...baselineFunctions,
      ...relevant.flatMap((proposal) => proposal.definedFunctions),
    ]),
  ].sort();
  const roleNames = [
    ...new Set([
      ...relevant.flatMap((proposal) => proposal.createdRoles),
      ...relevant.flatMap((proposal) =>
        Object.keys(proposal.sourceRoleDeps ?? {}),
      ),
      pins.externalRolePrerequisite.name,
      "world_v2_api_reader",
      "world_v2_api_login",
    ]),
  ].sort();
  const incompatibleOnlineReaderRoles = [
    ...new Set([
      ...roleNames.filter(
        (name) => name !== "world_v2_postwar_projection_reader",
      ),
      "anon",
      "authenticated",
      "service_role",
    ]),
  ].sort();
  const array = (values) =>
    "array[" + values.map(literal).join(",") + "]::text[]";
  const query = `begin isolation level repeatable read read only;
with
expected_relations(name) as (select unnest(${array(relationNames)})),
expected_functions(name) as (select unnest(${array(functionNames)})),
expected_roles(name) as (select unnest(${array(roleNames)})),
namespace as (select oid from pg_catalog.pg_namespace where nspname='world_v2'),
exact_function_contracts as (
 select contract,p.oid,p.proowner,p.prosecdef,p.proconfig,p.proacl
 from pg_catalog.jsonb_array_elements(${literal(JSON.stringify(exactFunctionContracts))}::jsonb)contract
 left join pg_catalog.pg_proc p on p.oid=case when exists(select 1 from namespace)then pg_catalog.to_regprocedure(contract->>'qualifiedSignature')else null end
),
relations as (
 select e.name,c.oid,c.relkind,c.relrowsecurity,c.relforcerowsecurity,c.relowner,
 pg_catalog.pg_get_userbyid(c.relowner) as owner
 from expected_relations e left join namespace n on true
 left join pg_catalog.pg_class c on c.relnamespace=n.oid and c.relname=e.name and c.relkind in('r','p')
),
roles as (
 select r.oid,r.rolname,r.rolcanlogin,r.rolsuper,r.rolbypassrls,r.rolcreatedb,r.rolcreaterole,r.rolreplication
 from pg_catalog.pg_roles r where r.rolname=any(${array(roleNames)}) or exists(
  select 1 from pg_catalog.pg_roles g where g.rolname=any(${array(roleNames)}) and pg_catalog.pg_has_role(r.oid,g.oid,'MEMBER'))
),
reader_shape as (
 select r.*,not(r.rolsuper or r.rolbypassrls or r.rolcreatedb or r.rolcreaterole or r.rolreplication)
 and exists(select 1 from pg_catalog.pg_roles g where g.rolname='world_v2_postwar_projection_reader' and pg_catalog.pg_has_role(r.oid,g.oid,'MEMBER'))
 and not exists(select 1 from pg_catalog.pg_roles g where g.rolname=any(${array(incompatibleOnlineReaderRoles)})and pg_catalog.pg_has_role(r.oid,g.oid,'MEMBER'))
 and exists(select 1 from namespace n where pg_catalog.has_schema_privilege(r.oid,n.oid,'USAGE'))
 and not exists(select 1 from namespace n where pg_catalog.has_schema_privilege(r.oid,n.oid,'CREATE'))
 and (select count(distinct p.proname)=2 and coalesce(bool_and(pg_catalog.has_function_privilege(r.oid,p.oid,'EXECUTE')),false)from pg_catalog.pg_proc p join namespace n on n.oid=p.pronamespace where (p.proname='read_postwar_office_projection_seats' and p.proargtypes='25'::pg_catalog.oidvector)or(p.proname='read_postwar_office_projection_page'and p.proargtypes='25 25 25 23 23 25'::pg_catalog.oidvector))
 and exists(select 1 from relations c join pg_catalog.pg_attribute a on a.attrelid=c.oid and a.attname='canonical_payload'and not a.attisdropped where c.name='opening_seed'and not pg_catalog.has_column_privilege(r.oid,c.oid,a.attnum,'SELECT'))
 and not exists(select 1 from pg_catalog.pg_class c join namespace n on n.oid=c.relnamespace where c.relkind in('r','p')and pg_catalog.has_table_privilege(r.oid,c.oid,'INSERT,UPDATE,DELETE,TRUNCATE'))
 and not exists(select 1 from relations c where c.name in('postwar_office_projection_page','postwar_office_projection_document')and c.oid is not null and pg_catalog.has_table_privilege(r.oid,c.oid,'SELECT'))
 as bounded_privilege_shape_compatible
 from roles r
)
select pg_catalog.jsonb_build_object(
 'schemaVersion','WORLD_V2_POSTWAR_CATALOG_OBSERVATION_V1',
 'projectBinding',${literal(WORLD_V2_RELEASE_PROJECT_REF)},
 'sourceCommit',${literal(pins.sourceCommit)},
 'transactionReadOnly',pg_catalog.current_setting('transaction_read_only'),
 'transactionIsolation',pg_catalog.current_setting('transaction_isolation'),
 'serverVersionNum',pg_catalog.current_setting('server_version_num'),
 'worldSchemaExists',exists(select 1 from namespace),
 'productionReleaseApproved',false,
 'runtimeBindingVerified',false,
 'relations',coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('name',c.name,'exists',c.oid is not null,'kind',c.relkind,'owner',c.owner,'rls',c.relrowsecurity,'forceRls',c.relforcerowsecurity,
 'columns',coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('name',a.attname,'type',pg_catalog.format_type(a.atttypid,a.atttypmod),'notNull',a.attnotnull)order by a.attnum)from pg_catalog.pg_attribute a where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped),'[]'::jsonb),
 'triggers',coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('name',t.tgname,'enabled',t.tgenabled,'internal',t.tgisinternal,'function',p.proname,'definitionSha256',encode(sha256(convert_to(pg_catalog.pg_get_triggerdef(t.oid),'UTF8')),'hex'))order by t.tgname)from pg_catalog.pg_trigger t join pg_catalog.pg_proc p on p.oid=t.tgfoid where t.tgrelid=c.oid),'[]'::jsonb),
 'policies',coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('name',p.polname,'command',p.polcmd,'permissive',p.polpermissive,'roles',(select pg_catalog.jsonb_agg(case when x=0 then 'PUBLIC'else pg_catalog.pg_get_userbyid(x)end)from unnest(p.polroles)x),'usingSha256',encode(sha256(convert_to(coalesce(pg_catalog.pg_get_expr(p.polqual,p.polrelid),''),'UTF8')),'hex'),'checkSha256',encode(sha256(convert_to(coalesce(pg_catalog.pg_get_expr(p.polwithcheck,p.polrelid),''),'UTF8')),'hex'))order by p.polname)from pg_catalog.pg_policy p where p.polrelid=c.oid),'[]'::jsonb)
 )order by c.name)from relations c),'[]'::jsonb),
 'roles',coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('name',r.rolname,'login',r.rolcanlogin,'superuser',r.rolsuper,'bypassRls',r.rolbypassrls,'createDb',r.rolcreatedb,'createRole',r.rolcreaterole,'replication',r.rolreplication,'boundedPrivilegeShapeCompatible',r.bounded_privilege_shape_compatible,'connectionAndBindingVerified',false)order by r.rolname)from reader_shape r),'[]'::jsonb),
 'missingNamedRoles',coalesce((select pg_catalog.jsonb_agg(e.name order by e.name)from expected_roles e where not exists(select 1 from roles r where r.rolname=e.name)),'[]'::jsonb),
 'memberships',coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('group',g.rolname,'member',m.rolname,'adminOption',a.admin_option)order by g.rolname,m.rolname)from pg_catalog.pg_auth_members a join roles g on g.oid=a.roleid join pg_catalog.pg_roles m on m.oid=a.member),'[]'::jsonb),
 'exactFunctionContracts',coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
 'qualifiedSignature',c.contract->>'qualifiedSignature','proposalId',c.contract->>'proposalId','exists',c.oid is not null,
 'expectedOwner',c.contract->>'owner','observedOwner',pg_catalog.pg_get_userbyid(c.proowner),'ownerMatches',coalesce(pg_catalog.pg_get_userbyid(c.proowner)=c.contract->>'owner',false),
 'securityDefinerMatches',coalesce(c.prosecdef=(c.contract->>'securityDefiner')::boolean,false),
 'searchPathMatches',coalesce(exists(select 1 from unnest(c.proconfig)v where v='search_path='||(c.contract->>'searchPath')),false),
 'publicExecute',case when c.oid is not null then exists(select 1 from pg_catalog.aclexplode(coalesce(c.proacl,pg_catalog.acldefault('f',c.proowner)))a where a.grantee=0 and a.privilege_type='EXECUTE')else null end,
 'expectedPublicExecute',(c.contract->>'publicExecute')::boolean,
 'namedExecutePrivileges',coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('role',name,'exists',r.oid is not null,'execute',case when r.oid is not null and c.oid is not null then pg_catalog.has_function_privilege(r.oid,c.oid,'EXECUTE')else false end)order by name)from pg_catalog.jsonb_array_elements_text(c.contract->'executeRoles')name left join pg_catalog.pg_roles r on r.rolname=name),'[]'::jsonb),
 'unexpectedDirectExecuteGrantees',coalesce((select pg_catalog.jsonb_agg(pg_catalog.pg_get_userbyid(a.grantee)order by a.grantee)from pg_catalog.aclexplode(coalesce(c.proacl,pg_catalog.acldefault('f',c.proowner)))a where a.privilege_type='EXECUTE'and a.grantee<>0 and a.grantee<>c.proowner and not exists(select 1 from pg_catalog.jsonb_array_elements_text(c.contract->'executeRoles')x where x=pg_catalog.pg_get_userbyid(a.grantee))),'[]'::jsonb)
 )order by c.contract->>'qualifiedSignature')from exact_function_contracts c),'[]'::jsonb),
 'functions',coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('name',e.name,'exists',p.oid is not null,'identityArguments',case when p.oid is not null then pg_catalog.pg_get_function_identity_arguments(p.oid)else null end,'owner',pg_catalog.pg_get_userbyid(p.proowner),'securityDefiner',p.prosecdef,
 'searchPath',(select split_part(v,'=',2)from unnest(p.proconfig)v where v like 'search_path=%'limit 1),
 'publicExecute',case when p.oid is not null then exists(select 1 from pg_catalog.aclexplode(coalesce(p.proacl,pg_catalog.acldefault('f',p.proowner)))a where a.grantee=0 and a.privilege_type='EXECUTE')else null end,
 'definitionSha256',case when p.oid is not null then encode(sha256(convert_to(pg_catalog.pg_get_functiondef(p.oid),'UTF8')),'hex')else null end)order by e.name,p.oid)from expected_functions e left join namespace n on true left join pg_catalog.pg_proc p on p.pronamespace=n.oid and p.proname=e.name and p.prokind='f'),'[]'::jsonb)
) as catalog_observation;
rollback;
`;
  return query;
}
async function verifySource(sourceRoot, candidateSha) {
  if (candidateSha !== undefined)
    return loadPostwarExpandedProposalCandidate(sourceRoot, candidateSha);
  const pins = await binding();
  if (!path.isAbsolute(sourceRoot))
    throw Error("ABSOLUTE_WORLD_SOURCE_REQUIRED");
  const git = (args) =>
    execFileSync("git", ["-C", sourceRoot, ...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  if (
    git(["rev-parse", "HEAD"]) !== pins.sourceCommit ||
    git(["rev-parse", "HEAD^{tree}"]) !== pins.sourceTree ||
    git(["remote", "get-url", "origin"]) !== pins.sourceRemote ||
    git(["status", "--porcelain=v1", "--untracked-files=all"])
  )
    throw Error("EXACT_CLEAN_WORLD_CANDIDATE_REQUIRED");
  const exactFile = async (relative, expectedSha, expectedBytes) => {
    const target = path.join(sourceRoot, relative);
    if (!(await lstat(target)).isFile() || (await realpath(target)) !== target)
      throw Error("REGULAR_SOURCE_ARTIFACT_REQUIRED");
    const bytes = await readFile(target);
    if (
      digest(bytes) !== expectedSha ||
      (expectedBytes !== undefined && bytes.length !== expectedBytes)
    )
      throw Error("PINNED_SOURCE_BYTES_MISMATCH");
    return bytes;
  };
  const manifest = JSON.parse(
    await exactFile(pins.manifestPath, pins.manifestSha256),
  );
  if (
    manifest.production_publisher !== "main-site-release-chain" ||
    manifest.migrations.length !== pins.registeredMigrationCount ||
    pins.proposals.some((p) =>
      manifest.migrations.some((m) => m.path === p.path),
    )
  )
    throw Error("REGISTERED_BASELINE_OR_UNREGISTERED_PROPOSAL_CHANGED");
  await Promise.all([
    ...pins.proposals.map((p) => exactFile(p.path, p.sha256, p.bytes)),
    ...manifest.migrations.map((m) => exactFile(m.path, m.sha256)),
  ]);
  return { pins, manifest };
}
export async function preparePostwarProductionPreflight({
  sourceRoot,
  outputDirectory,
  candidateSha,
}) {
  const { pins, manifest } = await verifySource(sourceRoot, candidateSha);
  if (!path.isAbsolute(outputDirectory))
    throw Error("ABSOLUTE_FRESH_OUTPUT_REQUIRED");
  outputDirectory = path.join(
    await realpath(path.dirname(outputDirectory)),
    path.basename(outputDirectory),
  );
  const actualSource = await realpath(sourceRoot);
  if (
    outputDirectory === actualSource ||
    outputDirectory.startsWith(actualSource + path.sep)
  )
    throw Error("OUTPUT_OUTSIDE_WORLD_SOURCE_REQUIRED");
  await mkdir(outputDirectory); // exclusive fresh directory; never overwrite a handoff
  const query = catalogQueryForPins(pins);
  const expectation = {
    ...pins,
    catalogQuerySha256: digest(query),
    bindingSha256: BINDING_SHA256,
    bindingSha256Meaning:
      candidateSha === undefined
        ? "HISTORICAL_8CBE_BASELINE_BINDING_ONLY"
        : "HISTORICAL_BASELINE_REFERENCE; expandedPolicySha256 selects proposal policy",
    candidateCompleteness:
      candidateSha === undefined
        ? "HISTORICAL_SIX_PROPOSALS_NOT_CURRENT_BATCH"
        : "ALLOWLISTED_CANDIDATE_BYTES_OBSERVED_NOT_APPROVED_OR_INSTALLED",
    status: "RENDERED_ONLY_PRODUCTION_NOT_VERIFIED",
    productionExecution: "NOT_AVAILABLE",
    databaseOperations: 0,
    networkRequests: 0,
    newCredentials: 0,
    newRoleGrants: 0,
    registeredBaseline: manifest.migrations.map((m) => ({
      id: m.migration_id,
      path: m.path,
      sha256: m.sha256,
      releaseOrder: m.release_order,
    })),
    minimumRoleHandoff: {
      sourceRoleDeps: pins.proposals
        .filter((p) => !p.disposition.startsWith("EXCLUDED_"))
        .map((p) => ({
          proposalId: p.id,
          dependencies: p.dependencies,
          sourceRoleDeps: p.sourceRoleDeps ?? {},
          productionReviewVerified: false,
        })),
      inaccessibleDefiners: [
        "world_v2_admission_owner",
        "world_v2_postwar_projection_owner",
      ],
      noLoginGroups: [
        "world_v2_admission_release",
        "world_v2_postwar_projection_publisher",
        "world_v2_postwar_projection_reader",
      ],
      candidateNoLoginRoles: [
        ...new Set(
          pins.proposals
            .filter((p) => !p.disposition.startsWith("EXCLUDED_"))
            .flatMap((p) => p.createdRoles),
        ),
      ].sort(),
      candidateRoleAttributes:
        "NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION",
      candidateDefinerOwners: [
        ...new Set(pins.proposals.flatMap((p) => p.createdRoles)),
      ]
        .filter((role) => role.endsWith("_owner"))
        .sort(),
      candidateSourcePublisherGroups: [
        ...new Set(pins.proposals.flatMap((p) => p.createdRoles)),
      ]
        .filter(
          (role) => role.endsWith("_publisher") || role.endsWith("_release"),
        )
        .sort(),
      runtimeRoleEnrollment:
        "NOT_PERFORMED; existing logins/memberships and writer lock rights require separate owner review",
      existingReaderReuse:
        "NOT_VERIFIED; catalog privilege shape is necessary but not sufficient",
      readerPermissions:
        "schema USAGE and bounded header/page function EXECUTE only; no raw seed or direct projection table SELECT",
      admissionPublisher:
        "existing dedicated session matching world_v2_opening_admission_*; only exact admission registry/lock/publish/readback EXECUTE after separate review",
      offlineRawReader:
        "optional separate existing NOLOGIN group; never inherited by online reader",
      enrollmentAndGrants: "NOT_PERFORMED_NOT_APPROVED_BY_THIS_HANDOFF",
    },
    rollbackReview: {
      executionAllowed: false,
      automaticDowngrade: false,
      policy:
        pins.rollbackPolicy ??
        "Separate approved release reversal required; never mutate committed history",
      proposalChecks: pins.proposals
        .filter(
          (p) => !p.disposition.startsWith("EXCLUDED_") && p.rollbackChecks,
        )
        .map((p) => ({
          id: p.id,
          checks: p.rollbackChecks,
          permissionDelta: p.permissionDelta,
          functionContracts: p.functionContracts,
        })),
      finalWorldShaStillRequired: candidateSha === undefined,
    },
    controlledOwnerChain: {
      repository: "samuelq800/econmind-os",
      workflow: ".github/workflows/release-world-v2-schema.yml",
      concurrencyGroup: "supabase-production",
      currentWorkflowPurpose:
        "historic immutable baseline; does not install these proposals",
      nextAction:
        "review exact candidate, register an explicit approved migration/release delta in this owning repository; this renderer cannot do it",
    },
  };
  await Promise.all([
    writeFile(path.join(outputDirectory, "catalog.sql"), query, { flag: "wx" }),
    writeFile(
      path.join(outputDirectory, "request.json"),
      JSON.stringify({ query }) + "\n",
      { flag: "wx" },
    ),
    writeFile(
      path.join(outputDirectory, "expectation.json"),
      JSON.stringify(expectation, null, 2) + "\n",
      { flag: "wx" },
    ),
  ]);
  return expectation;
}
async function main() {
  const args = process.argv.slice(2);
  if (
    ![4, 6].includes(args.length) ||
    args[0] !== "--source-root" ||
    args[2] !== "--output-directory" ||
    (args.length === 6 && args[4] !== "--candidate-sha")
  )
    throw Error("ONLY_FIXED_SOURCE_RENDER_ARGUMENTS_ACCEPTED");
  const result = await preparePostwarProductionPreflight({
    sourceRoot: args[1],
    outputDirectory: args[3],
    candidateSha: args.length === 6 ? args[5] : undefined,
  });
  process.stdout.write(
    JSON.stringify({
      status: result.status,
      projectRef: result.projectRef,
      sourceCommit: result.sourceCommit,
      catalogQuerySha256: result.catalogQuerySha256,
      installationAllowed: false,
    }) + "\n",
  );
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
)
  main().catch(() => {
    process.stderr.write(
      "POSTWAR_CATALOG_PREFLIGHT_RENDER_FAILED_NO_PRODUCTION_EXECUTION\n",
    );
    process.exitCode = 1;
  });
