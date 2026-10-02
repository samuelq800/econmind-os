import { createHash } from "node:crypto";

export const SNAPSHOT_PROJECT_REF = "vimksjrhaxdpnkvgsavz";
export const SNAPSHOT_BUCKET = "world-v2-official-source-v1";
export const SNAPSHOT_PREFIX =
  "88dd44478f97d2e8893a4f11b3aaf96e256bdb13248aca0d08f097fabe10d315";
export const SNAPSHOT_MANIFEST_SHA256 =
  "6b7295223568fc8592a56a7c4f112ade1406f2f7c0bec69066ecb24343ffaa0e";
const PROJECT_URL = `https://${SNAPSHOT_PROJECT_REF}.supabase.co`;
const MANAGEMENT_URL = `https://api.supabase.com/v1/projects/${SNAPSHOT_PROJECT_REF}/api-keys?reveal=true`;
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const bucketProperties = Object.freeze({
  id: SNAPSHOT_BUCKET,
  name: SNAPSHOT_BUCKET,
  public: true,
  file_size_limit: 9_000_000,
  allowed_mime_types: ["application/json"],
});
function fail(code) {
  throw new Error(code);
}

function checkedManifest(manifest) {
  if (!Array.isArray(manifest) || manifest.length !== 34)
    fail("SNAPSHOT_TRANSPORT_MANIFEST_INVALID");
  const normalized = manifest.map((item) => ({
    source_path: item.source_path,
    storage_path: item.storage_path,
    sha256: item.sha256,
    bytes: item.bytes,
  }));
  if (hash(JSON.stringify(normalized)) !== SNAPSHOT_MANIFEST_SHA256)
    fail("SNAPSHOT_TRANSPORT_MANIFEST_INVALID");
  return new Map(
    normalized.map((item) => [
      `${SNAPSHOT_PREFIX}/${item.sha256}.json`,
      Object.freeze(item),
    ]),
  );
}

async function boundedBytes(response, limit) {
  if (!response.body) fail("SNAPSHOT_TRANSPORT_BODY_MISSING");
  const reader = response.body.getReader();
  const parts = [];
  let bytes = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > limit) fail("SNAPSHOT_TRANSPORT_BODY_LIMIT");
      parts.push(value);
    }
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
  return Buffer.concat(parts);
}
async function boundedJson(response, limit = 65_536) {
  try {
    return JSON.parse((await boundedBytes(response, limit)).toString("utf8"));
  } catch {
    fail("SNAPSHOT_TRANSPORT_JSON_INVALID");
  }
}
async function isMissing(response) {
  if (response.status === 404) {
    await response.body?.cancel();
    return true;
  }
  if (response.status !== 400) return false;
  const value = await boundedJson(response, 16_384);
  return String(value?.statusCode) === "404" && value?.error === "not_found";
}

// Frozen pre-admission predicate for the historical metadata receipt only.
// Do not reinterpret existing_selector_candidates as the new selection rule.
function isExistingStorageKeyCandidate(item) {
  return (
    (item?.type === "secret" &&
      item.secret_jwt_template?.role === "service_role") ||
    (item?.name === "service_role" && item.type !== "publishable")
  );
}

/** Aggregate metadata only: never return identifiers, names, keys, templates,
 * unknown type values or response bytes. Does not acquire/select a credential. */
export function snapshotPublisherKeyMetadata(entries) {
  if (!Array.isArray(entries)) fail("SNAPSHOT_PUBLISHER_KEY_RESPONSE_INVALID");
  if (
    entries.length > 100 ||
    entries.some(
      (item) => !item || typeof item !== "object" || Array.isArray(item),
    )
  )
    fail("SNAPSHOT_PUBLISHER_KEY_METADATA_SHAPE_INVALID");
  const types = {
    legacy: 0,
    publishable: 0,
    secret: 0,
    null: 0,
    missing: 0,
    other: 0,
  };
  const fields = {
    api_key: 0,
    id: 0,
    type: 0,
    name: 0,
    secret_jwt_template: 0,
  };
  const apiKeyShape = { string: 0, null: 0, missing: 0, other: 0 };
  const matches = {
    legacy_name_service_role: 0,
    secret_template_service_role: 0,
    existing_selector_candidates: 0,
  };
  for (const item of entries) {
    for (const field of Object.keys(fields))
      if (Object.hasOwn(item, field)) fields[field]++;
    const type = !Object.hasOwn(item, "type")
      ? "missing"
      : item.type === null
        ? "null"
        : ["legacy", "publishable", "secret"].includes(item.type)
          ? item.type
          : "other";
    types[type]++;
    const shape = !Object.hasOwn(item, "api_key")
      ? "missing"
      : item.api_key === null
        ? "null"
        : typeof item.api_key === "string"
          ? "string"
          : "other";
    apiKeyShape[shape]++;
    if (item.type === "legacy" && item.name === "service_role")
      matches.legacy_name_service_role++;
    if (
      item.type === "secret" &&
      item.secret_jwt_template?.role === "service_role"
    )
      matches.secret_template_service_role++;
    if (isExistingStorageKeyCandidate(item))
      matches.existing_selector_candidates++;
  }
  return {
    total_entries: entries.length,
    types,
    field_presence_counts: fields,
    api_key_shape_counts: apiKeyShape,
    known_role_match_counts: matches,
  };
}

function existingStorageKey(entries) {
  const record = (value) =>
    value !== null && typeof value === "object" && !Array.isArray(value);
  if (!Array.isArray(entries) || entries.some((item) => !record(item)))
    fail("SNAPSHOT_PUBLISHER_KEY_RESPONSE_INVALID");
  for (const item of entries) {
    const template = item.secret_jwt_template;
    if (
      item.type === "secret" &&
      (!record(template) ||
        typeof template.role !== "string" ||
        template.role.length === 0 ||
        (item.name === "service_role" && template.role !== "service_role"))
    )
      fail("SNAPSHOT_PUBLISHER_KEY_METADATA_INVALID");
  }
  // Never choose-first or fall back after finding an eligible modern key.
  // Candidate counts precede key-value validation; duplicates remain ambiguous.
  const modern = entries.filter(
    (item) =>
      item.type === "secret" &&
      item.secret_jwt_template.role === "service_role",
  );
  const candidates =
    modern.length > 0
      ? modern
      : entries.filter(
          (item) => item.type === "legacy" && item.name === "service_role",
        );
  if (candidates.length === 0) fail("SNAPSHOT_PUBLISHER_KEY_NOT_FOUND");
  if (candidates.length > 1) fail("SNAPSHOT_PUBLISHER_KEY_MULTIPLE");
  const template = candidates[0].secret_jwt_template;
  if (
    candidates[0].type === "legacy" &&
    template != null &&
    (!record(template) ||
      (Object.hasOwn(template, "role") && template.role !== "service_role"))
  )
    fail("SNAPSHOT_PUBLISHER_KEY_METADATA_INVALID");
  if (typeof candidates[0].api_key !== "string")
    fail("SNAPSHOT_PUBLISHER_KEY_TYPE_INVALID");
  const key = candidates[0].api_key;
  if (candidates[0].type === "secret") {
    if (!/^sb_secret_[A-Za-z0-9_-]{20,}$/u.test(key))
      fail("SNAPSHOT_PUBLISHER_KEY_INVALID");
  } else {
    try {
      const claims = JSON.parse(
        Buffer.from(key.split(".")[1], "base64url").toString("utf8"),
      );
      if (
        !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/u.test(key) ||
        claims.ref !== SNAPSHOT_PROJECT_REF ||
        claims.role !== "service_role"
      )
        fail("SNAPSHOT_PUBLISHER_KEY_INVALID");
    } catch {
      fail("SNAPSHOT_PUBLISHER_KEY_INVALID");
    }
  }
  return key;
}

/** Fixed Storage API capability, not a naturally bucket-scoped credential.
 * Only GET/list/create exists. All paths, keys, byte counts and hashes are
 * constrained in code; caller receives no key or arbitrary request primitive. */
function transportWithLease(manifest, lease, fetchRequest) {
  const objects = checkedManifest(manifest);
  const checkBucket = (bucket) => {
    if (bucket !== SNAPSHOT_BUCKET) fail("SNAPSHOT_TRANSPORT_SCOPE_REJECTED");
  };
  const checkObject = (bucket, key) => {
    checkBucket(bucket);
    const spec = objects.get(key);
    if (!spec) fail("SNAPSHOT_TRANSPORT_SCOPE_REJECTED");
    return spec;
  };
  async function request(path, init = {}, publicRead = false) {
    if (!lease.active) fail("SNAPSHOT_PUBLISHER_CREDENTIAL_RETIRED");
    const headers = new Headers(init.headers);
    if (!publicRead) {
      headers.set("apikey", lease.key);
      if (!lease.key.startsWith("sb_secret_"))
        headers.set("authorization", `Bearer ${lease.key}`);
    }
    try {
      const response = await fetchRequest(`${PROJECT_URL}/storage/v1/${path}`, {
        ...init,
        headers,
        redirect: "error",
        credentials: "omit",
        signal: AbortSignal.any([
          AbortSignal.timeout(15_000),
          lease.controller.signal,
        ]),
      });
      if (response.redirected) fail("SNAPSHOT_TRANSPORT_REDIRECT_REJECTED");
      return response;
    } catch {
      fail(
        init.method === "POST"
          ? "SNAPSHOT_WRITE_OUTCOME_UNKNOWN_NO_RETRY"
          : "SNAPSHOT_TRANSPORT_READ_FAILED",
      );
    }
  }
  return Object.freeze({
    async getBucket(bucket) {
      checkBucket(bucket);
      const response = await request(`bucket/${SNAPSHOT_BUCKET}`);
      if (await isMissing(response)) return null;
      if (response.status !== 200) fail("SNAPSHOT_BUCKET_READ_FAILED");
      const value = await boundedJson(response);
      return {
        id: value.id,
        name: value.name,
        public: value.public,
        file_size_limit: value.file_size_limit,
        allowed_mime_types: value.allowed_mime_types,
      };
    },
    async createBucket(properties) {
      if (JSON.stringify(properties) !== JSON.stringify(bucketProperties))
        fail("SNAPSHOT_TRANSPORT_SCOPE_REJECTED");
      const response = await request("bucket", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(bucketProperties),
      });
      await response.body?.cancel();
      if (![200, 201].includes(response.status))
        fail("SNAPSHOT_BUCKET_OUTCOME_UNKNOWN_NO_RETRY");
    },
    async listKeys(bucket) {
      checkBucket(bucket);
      async function list(prefix) {
        const response = await request(`object/list/${SNAPSHOT_BUCKET}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            prefix,
            limit: 100,
            offset: 0,
            sortBy: { column: "name", order: "asc" },
          }),
        });
        if (response.status !== 200) fail("SNAPSHOT_OBJECT_LIST_FAILED");
        const entries = await boundedJson(response);
        if (!Array.isArray(entries) || entries.length >= 100)
          fail("SNAPSHOT_OBJECT_LIST_INVALID");
        return entries;
      }
      const roots = await list("");
      if (
        roots.some(
          (item) => item?.name !== SNAPSHOT_PREFIX || item.id !== null,
        ) ||
        roots.length > 1
      )
        fail("SNAPSHOT_UNEXPECTED_PUBLIC_OBJECT");
      if (roots.length === 0) return [];
      const entries = await list(`${SNAPSHOT_PREFIX}/`);
      const keys = entries.map((item) => {
        if (
          typeof item?.name !== "string" ||
          typeof item.id !== "string" ||
          item.id.length === 0
        )
          fail("SNAPSHOT_UNEXPECTED_PUBLIC_OBJECT");
        const key = `${SNAPSHOT_PREFIX}/${item.name}`;
        checkObject(bucket, key);
        return key;
      });
      if (new Set(keys).size !== keys.length)
        fail("SNAPSHOT_OBJECT_LIST_INVALID");
      return keys;
    },
    async readObject(bucket, key) {
      const spec = checkObject(bucket, key);
      const response = await request(
        `object/public/${SNAPSHOT_BUCKET}/${key}`,
        { headers: { accept: "application/json" } },
        true,
      );
      if (await isMissing(response)) return null;
      if (
        response.status !== 200 ||
        response.headers
          .get("content-type")
          ?.split(";")[0]
          ?.trim()
          .toLowerCase() !== "application/json"
      )
        fail("SNAPSHOT_OBJECT_PUBLIC_READ_FAILED");
      const bytes = await boundedBytes(response, spec.bytes);
      if (bytes.length !== spec.bytes || hash(bytes) !== spec.sha256)
        fail("SNAPSHOT_OBJECT_PUBLIC_HASH_INVALID");
      return bytes;
    },
    async createObject(bucket, key, bytes, options) {
      const spec = checkObject(bucket, key);
      if (
        !(bytes instanceof Uint8Array) ||
        bytes.byteLength !== spec.bytes ||
        hash(bytes) !== spec.sha256 ||
        options?.contentType !== "application/json" ||
        options?.upsert !== false
      )
        fail("SNAPSHOT_TRANSPORT_SOURCE_REJECTED");
      const response = await request(`object/${SNAPSHOT_BUCKET}/${key}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-upsert": "false",
          "cache-control": "max-age=31536000, immutable",
        },
        body: bytes,
      });
      await response.body?.cancel();
      if (![200, 201].includes(response.status))
        fail("SNAPSHOT_OBJECT_OUTCOME_UNKNOWN_NO_RETRY");
    },
  });
}

/** No CLI/automatic execution. The future single reviewed main-site runner
 * supplies its existing management token. No key is written to disk/env/secret
 * storage or returned. JS/fetch strings cannot be guaranteed securely erased:
 * finally drops our references and retires every retained transport method. */
export async function withEphemeralSnapshotTransport(
  { manifest, managementToken, fetchRequest = fetch },
  operation,
) {
  checkedManifest(manifest);
  if (
    typeof managementToken !== "string" ||
    managementToken.length === 0 ||
    typeof operation !== "function"
  )
    fail("SNAPSHOT_PUBLISHER_CONTEXT_INVALID");
  const lease = { active: false, key: "", controller: new AbortController() };
  let entries;
  try {
    const response = await fetchRequest(MANAGEMENT_URL, {
      method: "GET",
      headers: { authorization: `Bearer ${managementToken}` },
      redirect: "error",
      credentials: "omit",
      signal: AbortSignal.timeout(10_000),
    });
    if (response.status !== 200 || response.redirected)
      fail("SNAPSHOT_PUBLISHER_KEY_ACQUISITION_FAILED");
    entries = await boundedJson(response, 32_768);
    lease.key = existingStorageKey(entries);
    lease.active = true;
    // Do not retain unrelated key entries through the publication callback.
    for (const entry of entries)
      if (entry && typeof entry === "object") entry.api_key = "";
    entries = undefined;
    return await operation(transportWithLease(manifest, lease, fetchRequest));
  } catch (error) {
    const code =
      error instanceof Error && /^SNAPSHOT_[A-Z0-9_]+$/u.test(error.message)
        ? error.message
        : "SNAPSHOT_PUBLISHER_OPERATION_FAILED";
    fail(code);
  } finally {
    lease.controller.abort();
    lease.active = false;
    lease.key = "";
    if (Array.isArray(entries))
      for (const entry of entries)
        if (entry && typeof entry === "object") entry.api_key = "";
    entries = undefined;
  }
}

// Pure catalog SELECT: limited to two Storage relations, two ordinary roles
// and applicable policies. No user rows, routine bodies, passwords or writes.
export const SNAPSHOT_STORAGE_PERMISSION_SQL = `with roles as (
  select oid,rolname,rolsuper,rolbypassrls from pg_roles where rolname in ('anon','authenticated')
), relations as (
  select c.oid,c.relname,c.relowner,c.relrowsecurity from pg_class c
  join pg_namespace n on n.oid=c.relnamespace where n.nspname='storage' and c.relname in ('objects','buckets')
)
select jsonb_build_object(
  'bucket', '${SNAPSHOT_BUCKET}',
  'relations', (select jsonb_agg(jsonb_build_object('name',relname,'rls',relrowsecurity) order by relname) from relations),
  'roles', (select jsonb_agg(jsonb_build_object('role',r.rolname,'table',c.relname,
    'superuser',r.rolsuper,'bypass_rls',r.rolbypassrls,'owner_privileges',pg_has_role(r.oid,c.relowner,'USAGE'),
    'insert',has_table_privilege(r.oid,c.oid,'INSERT'), 'update',has_table_privilege(r.oid,c.oid,'UPDATE'),
    'delete',has_table_privilege(r.oid,c.oid,'DELETE'),
    'column_insert',has_any_column_privilege(r.oid,c.oid,'INSERT'),
    'column_update',has_any_column_privilege(r.oid,c.oid,'UPDATE')) order by r.rolname,c.relname) from roles r cross join relations c),
  'policies', coalesce((select jsonb_agg(jsonb_build_object('table',c.relname,'name',p.polname,
    'permissive',p.polpermissive,'command',p.polcmd,'qual',pg_get_expr(p.polqual,p.polrelid),
    'check',pg_get_expr(p.polwithcheck,p.polrelid),
    'applies_to',(select jsonb_agg(r.rolname order by r.rolname) from roles r where 0=any(p.polroles) or exists(
      select 1 from unnest(p.polroles) role_oid where case when role_oid=0 then false else pg_has_role(r.oid,role_oid,'USAGE') end))
  ) order by c.relname,p.polname) from pg_policy p join relations c on c.oid=p.polrelid),'[]'::jsonb)
) as evidence;`;

function deniesBucket(expression, table) {
  if (typeof expression !== "string") return false;
  const column = table === "objects" ? "bucket_id" : "id";
  // Keyword case is irrelevant; string-literal case/whitespace is NOT.
  const match = expression.match(
    new RegExp(
      `^\\(*\\s*${column}\\s+IS\\s+DISTINCT\\s+FROM\\s+'([^']*)'(?:\\s*::\\s*text)?\\s*\\)*$`,
      "iu",
    ),
  );
  return match?.[1] === SNAPSHOT_BUCKET;
}
export function verifyStorageWriteBoundary(evidence) {
  if (
    evidence?.bucket !== SNAPSHOT_BUCKET ||
    !Array.isArray(evidence.relations) ||
    evidence.relations.length !== 2 ||
    !Array.isArray(evidence.roles) ||
    evidence.roles.length !== 4 ||
    !Array.isArray(evidence.policies)
  )
    fail("SNAPSHOT_STORAGE_BOUNDARY_EVIDENCE_INVALID");
  if (
    new Set(evidence.relations.map((item) => item.name)).size !== 2 ||
    evidence.relations.some(
      (item) =>
        !["objects", "buckets"].includes(item.name) ||
        typeof item.rls !== "boolean",
    ) ||
    evidence.policies.some(
      (item) =>
        !["objects", "buckets"].includes(item.table) ||
        typeof item.name !== "string" ||
        typeof item.permissive !== "boolean" ||
        !["r", "a", "w", "d", "*"].includes(item.command) ||
        (item.qual !== null && typeof item.qual !== "string") ||
        (item.check !== null && typeof item.check !== "string") ||
        (item.applies_to !== null &&
          (!Array.isArray(item.applies_to) ||
            item.applies_to.some(
              (role) => !["anon", "authenticated"].includes(role),
            ))),
    )
  )
    fail("SNAPSHOT_STORAGE_BOUNDARY_EVIDENCE_INVALID");
  const seen = new Set();
  for (const role of evidence.roles) {
    const key = `${role.role}/${role.table}`;
    if (
      seen.has(key) ||
      !["anon", "authenticated"].includes(role.role) ||
      !["objects", "buckets"].includes(role.table)
    )
      fail("SNAPSHOT_STORAGE_BOUNDARY_EVIDENCE_INVALID");
    seen.add(key);
    if (
      role.superuser !== false ||
      role.bypass_rls !== false ||
      role.owner_privileges !== false
    )
      fail("SNAPSHOT_STORAGE_WRITE_BOUNDARY_BLOCKED");
    const relation = evidence.relations.find(
      (item) => item.name === role.table,
    );
    const policies = evidence.policies.filter(
      (item) =>
        item.table === role.table &&
        Array.isArray(item.applies_to) &&
        item.applies_to.includes(role.role),
    );
    for (const [action, command, kind] of [
      ["insert", "a", "check"],
      ["update", "w", "qual"],
      ["update", "w", "check"],
      ["delete", "d", "qual"],
    ]) {
      if (
        typeof role[action] !== "boolean" ||
        (action !== "delete" && typeof role[`column_${action}`] !== "boolean")
      )
        fail("SNAPSHOT_STORAGE_BOUNDARY_EVIDENCE_INVALID");
      if (
        role[action] === false &&
        (action === "delete" || role[`column_${action}`] === false)
      )
        continue;
      if (relation?.rls !== true)
        fail("SNAPSHOT_STORAGE_WRITE_BOUNDARY_BLOCKED");
      const matching = policies.filter(
        (item) => item.command === command || item.command === "*",
      );
      if (matching.some((item) => typeof item.permissive !== "boolean"))
        fail("SNAPSHOT_STORAGE_BOUNDARY_EVIDENCE_INVALID");
      // RLS default-deny or an exact bucket-only restrictive veto is sufficient;
      // arbitrary/function-dependent permissive policy expressions are not guessed.
      if (!matching.some((item) => item.permissive === true)) continue;
      if (
        !matching.some(
          (item) =>
            item.permissive === false &&
            deniesBucket(
              kind === "check" ? (item.check ?? item.qual) : item.qual,
              role.table,
            ),
        )
      )
        fail("SNAPSHOT_STORAGE_WRITE_BOUNDARY_BLOCKED");
    }
  }
  return {
    status: "SNAPSHOT_DIRECT_STORAGE_WRITE_DENIED",
    bucket: SNAPSHOT_BUCKET,
    roles: ["anon", "authenticated"],
    operations: [
      "insert",
      "update_from_scope",
      "update_into_scope",
      "delete",
      "upsert",
      "move",
    ],
    authority: "CATALOG_RLS_OR_MISSING_PRIVILEGE_ONLY",
    rpc_or_business_authorization: "NOT_CLAIMED",
  };
}
