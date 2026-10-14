import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { approvalSql } from "./approve-season1-pending.mjs";
const sql = readFileSync("scripts/approve-season1-pending.sql", "utf8");
const ids = Array.from(
  { length: 8 },
  (_, i) => `10000000-0000-0000-0000-${String(i + 1).padStart(12, "0")}`,
);
function run(input, expectFailure = false) {
  const result = spawnSync(
    process.env.PSQL_BIN || "psql",
    ["-X", "-v", "ON_ERROR_STOP=1", "-d", "season1_test", "-f", "-"],
    { input, encoding: "utf8", env: process.env },
  );
  if ((result.status === 0) === expectFailure)
    throw new Error(`${result.stdout}\n${result.stderr}`);
  return result;
}
run(readFileSync("scripts/test-season1-pending-fixture.sql", "utf8"));
run(`create function public.approval_fixture_failure() returns trigger language plpgsql as $$ begin
  if new.id='10000000-0000-0000-0000-000000000005' and new.status='accepted' then raise exception 'Injected maintenance failure'; end if; return new; end $$;
  create trigger approval_fixture_failure before update on public.world_preseason_team_applications for each row execute function public.approval_fixture_failure();`);
run(approvalSql(sql, ids), true);
run(`do $$ begin
 if exists(select 1 from public.world_preseason_team_members where user_id='00000000-0000-0000-0000-000000000032')
 or exists(select 1 from public.world_preseason_team_applications where id in ('10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000005') and status<>'pending')
 then raise exception 'Failed transaction did not roll back'; end if; end $$;
 drop trigger approval_fixture_failure on public.world_preseason_team_applications; drop function public.approval_fixture_failure();`);
const result = run(approvalSql(sql, ids));
if (
  !result.stdout.includes('"accepted": 2') ||
  !result.stdout.includes('"joined": 1')
)
  throw new Error("Unexpected maintenance counts");
run(`do $$ begin
 if (select count(*) from public.world_preseason_team_applications where id in (${ids.map((id) => `'${id}'`).join(",")}) and status='accepted')<>2
 or (select count(*) from public.world_preseason_team_applications where id in (${ids.map((id) => `'${id}'`).join(",")}) and status='pending')<>6
 or not exists(select 1 from public.world_preseason_team_applications where id='10000000-0000-0000-0000-000000000009' and status='pending')
 or (select count(*) from public.world_preseason_team_members where user_id='00000000-0000-0000-0000-000000000032')<>1
 or exists(select 1 from public.world_preseason_team_applications where id in (${ids.map((id) => `'${id}'`).join(",")}) and reviewed_by is not null)
 then raise exception 'Approval scope, conflicts, uniqueness or attribution failed'; end if; end $$;`);
run(approvalSql(sql, ids), true);
// Recruitment locking must not remove a captain's existing removal authority.
run(`update public.world_preseason_seasons set lobby_opens_at=now()-interval '1 day' where code='season-1';
 update public.world_preseason_teams set recruitment_locked=true where id='20000000-0000-0000-0000-000000000001';
 select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000032',false);
 do $$ begin
   begin perform public.world_preseason_remove_member('20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000031');
     raise exception 'Ordinary member unexpectedly removed captain';
   exception when others then if sqlerrm not like '%Only the current team captain%' then raise; end if; end;
 end $$;
 select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000031',false);
 select public.world_preseason_remove_member('20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000032');
 do $$ begin if exists(select 1 from public.world_preseason_team_members where user_id='00000000-0000-0000-0000-000000000032')
 then raise exception 'Captain cannot remove newly approved member'; end if; end $$;`);
console.log(
  "PASS: scoped approvals, conflicts, rollback, changed-batch rejection, no impersonation, captain removal preserved even with recruitment locked",
);
