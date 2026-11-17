#!/usr/bin/env python3
"""Rehearse credential migrations and synthetic issuance in one rolled-back transaction.

Runs against the currently linked Supabase project. It refuses existing target
objects and never sends the private template, signatures, or real recipients.
"""
import os
import re
import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
paths = [
    'supabase/migrations/20261116000000_credential_research_sources.sql',
    'supabase/migrations/20261116010000_credential_issuance_core.sql',
    'supabase/migrations/20261116020000_shared_team_directory.sql',
    'supabase/migrations/20261116030000_credential_research_realtime.sql',
    'supabase/migrations/20261116060000_credential_browser_print.sql',
    'supabase/seeds/organization_directory_snapshot_20261115.sql',
]
chunks = []
for path in paths:
    content = (ROOT / path).read_text()
    if len(re.findall(r'(?im)^\s*begin;\s*$', content)) != 1 or len(re.findall(r'(?im)^\s*commit;\s*$', content)) != 1:
        raise SystemExit(f'Unexpected transaction structure in {path}')
    content = re.sub(r'(?im)^\s*(?:begin|commit);\s*$', '', content)
    chunks.append(content)
prefix = """begin;
set local lock_timeout='1s';
set local statement_timeout='15s';
do $guard$ begin
  if to_regclass('private.credentials') is not null or to_regclass('public.organization_directory') is not null
     or to_regclass('private.credential_visual_assets') is not null then
    raise exception 'Credential objects already exist; refusing rehearsal';
  end if;
end $guard$;
"""
checks = """
do $check$ begin
  if (select count(*) from public.organization_directory) <> 26 then raise exception 'Roster count mismatch'; end if;
  if has_table_privilege('authenticated','private.credential_visual_assets','select')
     or has_function_privilege('anon','public.get_credential_visual_assets()','execute') then
    raise exception 'Private visual assets are exposed';
  end if;
end $check$;
insert into private.credential_visual_assets(id,template_html,yale_signature)
  values(true,convert_to('synthetic','UTF8'),convert_to('synthetic','UTF8'));
select set_config('request.jwt.claim.sub',
  (select p.user_id::text from public.profiles p where p.account_status='active'
    and public.is_superme_platform_admin(p.user_id) limit 1), true);
set local role authenticated;
do $check$ declare t uuid; b uuid; issued jsonb; begin
  if auth.uid() is null then raise exception 'No active superme administrator'; end if;
  if (select count(*) from public.list_credential_research_sources(null,100)) < 1 then raise exception 'Research source unavailable'; end if;
  if (select count(*) from public.list_credential_organization_page(null,100)) <> 26 then raise exception 'Organization source unavailable'; end if;
  perform public.ensure_credential_starter_templates();
  select (item->>'id')::uuid into t from jsonb_array_elements(public.list_credential_admin_data()->'templates') item
    where item->>'category'='CON' and item->>'subtype'='Technical Contribution' limit 1;
  b := public.create_credential_draft(gen_random_uuid(),t,current_date,'EconMind Founder Team',
    jsonb_build_array(jsonb_build_object('name','Synthetic Test','user_id',auth.uid()::text)));
  perform public.review_credential_draft(b);
  perform public.confirm_credential_print_review(b,true);
  issued := public.issue_credential_batch(b);
  if issued->0->>'number' not like 'EML-CON-%-000001' then raise exception 'Unexpected numbering'; end if;
  if public.issue_credential_batch(b) <> issued then raise exception 'Repeated issue not idempotent'; end if;
end $check$;
rollback;
select to_regclass('private.credentials') is null
  and to_regclass('public.organization_directory') is null
  and to_regclass('private.credential_visual_assets') is null as rolled_back;
"""
sql = prefix + '\n'.join(chunks) + checks
with tempfile.NamedTemporaryFile(mode='w', prefix='credential-rollback-', suffix='.sql', delete=False) as file:
    path = Path(file.name)
    os.chmod(path, 0o600)
    file.write(sql)
try:
    result = subprocess.run([str(ROOT / 'node_modules/.bin/supabase'), 'db', 'query', '--linked', '--file', str(path), '--output', 'json'],
                            cwd=ROOT, capture_output=True, text=True, timeout=90, check=False)
    if result.returncode != 0:
        match = re.search(r'ERROR:\s*([^\\\n]+)', result.stderr)
        print('Rollback rehearsal failed' + (f': {match.group(1)}' if match else '.'))
        raise SystemExit(1)
    if not re.search(r'"rolled_back"\s*:\s*true', result.stdout):
        raise SystemExit('Rollback rehearsal returned no proof that the objects were removed.')
    print('PASS: production-compatible schema, authorized synthetic issuance, source imports, and rollback verified')
finally:
    path.unlink(missing_ok=True)
