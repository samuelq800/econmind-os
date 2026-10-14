import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";

export const PROJECT = "vimksjrhaxdpnkvgsavz";
export const pendingQuery = `select a.id from public.world_preseason_team_applications a
  join public.world_preseason_seasons s on s.id=a.season_id
  where s.code='season-1' and a.status='pending' order by a.id`;
export function inspectBatch(rows) {
  if (
    !Array.isArray(rows) ||
    rows.some(
      (row) =>
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          row?.id ?? "",
        ),
    )
  )
    throw new Error("Invalid application snapshot");
  const ids = rows.map((row) => row.id.toLowerCase()).sort();
  if (new Set(ids).size !== ids.length)
    throw new Error("Duplicate application IDs");
  return {
    ids,
    count: ids.length,
    fingerprint: createHash("sha256").update(JSON.stringify(ids)).digest("hex"),
  };
}
export function approvalSql(template, ids) {
  const batch = inspectBatch(ids.map((id) => ({ id })));
  if (
    !template.includes("'__APPLICATION_IDS_JSON__'::jsonb") ||
    !/^begin;$/m.test(template) ||
    !/commit;\s*$/.test(template)
  )
    throw new Error("Explicit scoped approval transaction required");
  return template.replace(
    "__APPLICATION_IDS_JSON__",
    JSON.stringify(batch.ids),
  );
}
export async function approvePending({
  request,
  mode,
  expectedFingerprint,
  template,
}) {
  if (!["preview", "approve"].includes(mode))
    throw new Error("Use preview or approve");
  const batch = inspectBatch(await request(pendingQuery, true));
  if (mode === "preview")
    return { mode, pending: batch.count, fingerprint: batch.fingerprint };
  if (
    !/^[a-f0-9]{64}$/.test(expectedFingerprint ?? "") ||
    batch.fingerprint !== expectedFingerprint
  )
    throw new Error(
      "Pending snapshot changed or fingerprint missing; preview again",
    );
  if (!batch.count)
    return { mode, pending: 0, accepted: 0, remainingPending: 0 };
  // One write attempt only. Never retry an uncertain result.
  return {
    mode,
    receipt: await request(approvalSql(template, batch.ids), false),
  };
}
async function main() {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!token || process.env.SUPABASE_PROJECT_REF !== PROJECT)
    throw new Error("Pinned production project required");
  const request = async (query, readOnly) => {
    const response = await fetch(
      `https://api.supabase.com/v1/projects/${PROJECT}/database/query${readOnly ? "/read-only" : ""}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query }),
        signal: AbortSignal.timeout(60000),
      },
    );
    if (!response.ok)
      throw new Error(
        `Approval failed (HTTP ${response.status}); provider body omitted`,
      );
    return response.json();
  };
  const guards = await request(
    `select
    position('Only the current team captain' in pg_get_functiondef('public.world_preseason_remove_member(uuid,uuid)'::regprocedure))>0
    and position('captain_user_id <> auth.uid()' in pg_get_functiondef('public.world_preseason_remove_member(uuid,uuid)'::regprocedure))>0
    and has_function_privilege('authenticated','public.world_preseason_remove_member(uuid,uuid)','execute')
    and not has_function_privilege('anon','public.world_preseason_remove_member(uuid,uuid)','execute') as captain_removal_verified`,
    true,
  );
  if (guards?.[0]?.captain_removal_verified !== true)
    throw new Error(
      "Existing captain removal permission could not be verified",
    );
  const result = await approvePending({
    mode: process.env.APPROVAL_MODE,
    expectedFingerprint: process.env.EXPECTED_FINGERPRINT,
    template: readFileSync("scripts/approve-season1-pending.sql", "utf8"),
    request,
  });
  console.log(
    JSON.stringify({
      project: PROJECT,
      captainRemovalVerified: true,
      ...result,
    }),
  );
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
