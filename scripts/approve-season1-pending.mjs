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
export function verificationQuery(ids) {
  const { ids: safe } = inspectBatch(ids.map((id) => ({ id })));
  return `with batch as (
    select a.*, case
      when exists(select 1 from public.world_preseason_team_members m where m.season_id=a.season_id and m.user_id=a.applicant_user_id and m.team_id<>a.team_id) then 'already_in_other_team'
      when not exists(select 1 from public.profiles p where p.user_id=a.applicant_user_id and p.account_status='active') then 'inactive_account'
      when t.recruitment_locked or t.status in ('frozen','dissolved','registered','active') then 'locked_team'
      when (select count(*) from public.world_preseason_team_members m where m.team_id=t.id)>=t.capacity then 'full_team'
      else 'unresolved' end as reason
    from public.world_preseason_team_applications a
    join public.world_preseason_seasons s on s.id=a.season_id and s.code='season-1'
    join public.world_preseason_teams t on t.id=a.team_id
    where a.id in (${safe.map((id) => `'${id}'`).join(",")})
  ) select jsonb_build_object(
    'inspected', count(*), 'accepted', count(*) filter(where status='accepted'),
    'pendingInBatch', count(*) filter(where status='pending'),
    'withdrawn', count(*) filter(where status='withdrawn'),
    'acceptedWithoutMembership', count(*) filter(where status='accepted' and not exists(select 1 from public.world_preseason_team_members m where m.season_id=batch.season_id and m.team_id=batch.team_id and m.user_id=batch.applicant_user_id)),
    'blocked',coalesce((select jsonb_object_agg(reason,n) from (select reason,count(*) n from batch where status='pending' group by reason) reasons),'{}'::jsonb),
    'remainingPending',(select count(*) from public.world_preseason_team_applications a join public.world_preseason_seasons s on s.id=a.season_id where s.code='season-1' and a.status='pending')
  ) as result from batch`;
}
export async function approvePending({
  request,
  mode,
  expectedFingerprint,
  template,
}) {
  if (!["preview", "approve", "withdraw-conflicts"].includes(mode))
    throw new Error(
      "Use preview, approve or explicitly authorized withdraw-conflicts",
    );
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
  await request(approvalSql(template, batch.ids), false);
  // An independent post-commit read proves actual membership, not just HTTP success.
  const rows = await request(verificationQuery(batch.ids), true);
  const result = rows?.[0]?.result;
  if (
    rows?.length !== 1 ||
    result?.inspected !== batch.count ||
    result?.acceptedWithoutMembership !== 0 ||
    (mode === "withdraw-conflicts"
      ? result?.withdrawn !== batch.count
      : result?.accepted + result?.pendingInBatch !== batch.count)
  )
    throw new Error(
      "Approval post-commit verification failed; inspect state, do not retry writes",
    );
  return { mode, verified: true, result };
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
    template: readFileSync(
      process.env.APPROVAL_MODE === "withdraw-conflicts"
        ? "scripts/withdraw-season1-conflicting-pending.sql"
        : "scripts/approve-season1-pending.sql",
      "utf8",
    ),
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
