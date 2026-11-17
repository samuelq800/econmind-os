#!/usr/bin/env python3
"""Two-stage scoped credential release. Never automatically retry writes."""
import base64
import hashlib
import json
import os
import re
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PROJECT = 'vimksjrhaxdpnkvgsavz'
MIGRATIONS = [
    ('20261116000000', 'credential_research_sources'),
    ('20261116010000', 'credential_issuance_core'),
    ('20261116020000', 'shared_team_directory'),
    ('20261116030000', 'credential_research_realtime'),
    ('20261116060000', 'credential_browser_print'),
]
ASSETS = [
    (Path(os.environ.get('CREDENTIAL_PRIVATE_TEMPLATE', '/Users/samuel/Documents/Codex/2026-11-16/referenced-chatgpt-conversation-this-is-an/outputs/EconMind_Certificate_Integration_Handoff/EconMind_League_Yale_Founding_Leadership_Certificate.html')), '591e6c0d67eec9b59ed856f060eca4d3ad5ed8d041b91bf3f67361cf0da6a358'),
    (Path(os.environ.get('CREDENTIAL_PRIVATE_YALE_SIGNATURE', '/Users/samuel/.codex/private/econmind-credentials/signatures/yale-chen.png')), '587af46f950be365383eb8505e77ec072472df5dbc77f6aba734f8ebdf161c53'),
]
choices = ('--rehearse-schema', '--publish-schema', '--rehearse-assets', '--publish-assets')
if len(sys.argv) != 2 or sys.argv[1] not in choices:
    raise SystemExit('Choose one of: ' + ', '.join(choices))
mode = sys.argv[1]
publish = mode.startswith('--publish')
schema = mode.endswith('schema')
if (ROOT / 'supabase/.temp/project-ref').read_text().strip() != PROJECT:
    raise SystemExit('Linked project does not match the approved project.')
if publish:
    head = subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip()
    if os.environ.get('CREDENTIAL_RELEASE_COMMIT') != head:
        raise SystemExit('CREDENTIAL_RELEASE_COMMIT must match the verified checkout.')
    if subprocess.check_output(['git','status','--porcelain'],cwd=ROOT,text=True).strip():
        raise SystemExit('Release checkout must be clean.')

migration_contents = []
for version, name in MIGRATIONS:
    content = (ROOT / f'supabase/migrations/{version}_{name}.sql').read_text()
    if len(re.findall(r'(?im)^\s*begin;\s*$', content)) != 1 or len(re.findall(r'(?im)^\s*commit;\s*$', content)) != 1:
        raise SystemExit(f'Unexpected transaction structure in migration {version}.')
    migration_contents.append(content)
versions = ','.join(f"'{version}'" for version, _ in MIGRATIONS)
prefix = "begin; set local lock_timeout='3s'; set local statement_timeout='30s';\n"
if schema:
    seed = (ROOT / 'supabase/seeds/organization_directory_snapshot_20261115.sql').read_text()
    if len(re.findall(r'(?im)^\s*begin;\s*$', seed)) != 1 or len(re.findall(r'(?im)^\s*commit;\s*$', seed)) != 1:
        raise SystemExit('Unexpected transaction structure in roster seed.')
    guard = f"""do $guard$ begin
      if to_regclass('private.credentials') is not null or to_regclass('public.organization_directory') is not null
        or to_regclass('private.credential_visual_assets') is not null
        or exists(select 1 from supabase_migrations.schema_migrations where version in ({versions})) then
        raise exception 'Credential objects or migration records already exist';
      end if;
    end $guard$;
    lock table public.research_papers in share row exclusive mode;
    create temporary table credential_release_preserved on commit drop as select
      (select md5(coalesce(jsonb_agg(to_jsonb(p) order by p.id),'[]'::jsonb)::text) from public.research_papers p) as papers,
      md5(pg_get_functiondef('public.is_superme_platform_admin(uuid)'::regprocedure)) as admin_authorizer;
    """
    chunks = [re.sub(r'(?im)^\s*(?:begin|commit);\s*$', '', content) for content in [*migration_contents, seed]]
    ledger = []
    for (version, name), content in zip(MIGRATIONS, migration_contents):
        encoded = base64.b64encode(content.encode()).decode()
        ledger.append(f"('{version}','{name}',array[convert_from(decode('{encoded}','base64'),'UTF8')])")
    verify = f"""do $verify$ begin
      if (select count(*) from public.organization_directory) <> 26
        or not (select activated and activation_method='deployment' and activated_at is not null from private.organization_directory_settings where singleton)
        or exists(select 1 from private.credential_visual_assets)
        or has_table_privilege('authenticated','private.credential_visual_assets','select')
        or has_function_privilege('anon','public.get_credential_visual_assets()','execute')
        or not has_function_privilege('authenticated','public.get_credential_visual_assets()','execute') then
        raise exception 'Credential schema verification failed';
      end if;
      if not (select papers=(select md5(coalesce(jsonb_agg(to_jsonb(p) order by p.id),'[]'::jsonb)::text) from public.research_papers p)
        and admin_authorizer=md5(pg_get_functiondef('public.is_superme_platform_admin(uuid)'::regprocedure)) from credential_release_preserved) then
        raise exception 'Existing research or administrator data changed';
      end if;
    end $verify$;
    insert into supabase_migrations.schema_migrations(version,name,statements) values {','.join(ledger)};
    """
    body = guard + '\n'.join(chunks) + verify
else:
    data = [path.read_bytes() for path, _ in ASSETS]
    if any(hashlib.sha256(value).hexdigest() != expected for value, (_, expected) in zip(data, ASSETS)):
        raise SystemExit('Private asset integrity check failed.')
    encoded = [base64.b64encode(value).decode() for value in data]
    ledger_checks = []
    for (version, _), content in zip(MIGRATIONS, migration_contents):
        expected = hashlib.sha256(content.encode()).hexdigest()
        ledger_checks.append(f"exists(select 1 from supabase_migrations.schema_migrations where version='{version}' and encode(extensions.digest(convert_to(statements[1],'UTF8'),'sha256'),'hex')='{expected}')")
    body = f"""do $guard$ begin
      if to_regclass('private.credential_visual_assets') is null or not ({' and '.join(ledger_checks)}) then
        raise exception 'Credential schema or migration history is not verified';
      end if;
      if exists(select 1 from private.credential_visual_assets where id and
        (encode(extensions.digest(template_html,'sha256'),'hex')<>'{ASSETS[0][1]}' or
         encode(extensions.digest(yale_signature,'sha256'),'hex')<>'{ASSETS[1][1]}')) then
        raise exception 'Different private assets already exist';
      end if;
    end $guard$;
    insert into private.credential_visual_assets(id,template_html,yale_signature)
      values(true,decode('{encoded[0]}','base64'),decode('{encoded[1]}','base64')) on conflict(id) do nothing;
    do $verify$ begin
      if not exists(select 1 from private.credential_visual_assets where id
        and encode(extensions.digest(template_html,'sha256'),'hex')='{ASSETS[0][1]}'
        and encode(extensions.digest(yale_signature,'sha256'),'hex')='{ASSETS[1][1]}') then
        raise exception 'Private asset verification failed';
      end if;
    end $verify$;
    """
if publish:
    ending = 'commit; select true as release_committed;'
elif schema:
    ending = "rollback; select to_regclass('private.credentials') is null and to_regclass('private.credential_visual_assets') is null as rolled_back;"
else:
    ending = "rollback; select not exists(select 1 from private.credential_visual_assets) as rolled_back;"
query = prefix + body + ending
with tempfile.NamedTemporaryFile(mode='w',prefix='credential-release-',suffix='.sql',delete=False) as file:
    path = Path(file.name)
    os.chmod(path,0o600)
    file.write(query)
try:
    try:
        result = subprocess.run([str(ROOT / 'node_modules/.bin/supabase'),'db','query','--linked','--file',str(path),'--output','json'],
                                cwd=ROOT,capture_output=True,text=True,timeout=120,check=False)
    except subprocess.TimeoutExpired:
        raise SystemExit('Release request timed out: outcome UNKNOWN. Inspect live state before any retry.')
    if result.returncode:
        safe = re.sub(r'[A-Za-z0-9+/=]{60,}', '[redacted]', result.stderr + '\n' + result.stdout)
        match = re.search(r'ERROR:\s*([^\\\n]{1,180})', safe)
        status = re.search(r'(?:status|HTTP)\s+([0-9]{3})', safe, re.IGNORECASE)
        detail = match.group(1) if match else f"provider status {status.group(1)}" if status else 'provider response withheld'
        raise SystemExit(f'Release request failed: {detail}. Inspect live state before any retry.')
    value = json.loads(result.stdout)
    key = 'release_committed' if publish else 'rolled_back'
    if not value.get('rows') or value['rows'][0].get(key) is not True:
        raise SystemExit('Release response is ambiguous. Inspect live state before any retry.')
    print(f"PASS: {'schema' if schema else 'private assets'} {'committed' if publish else 'rehearsed and rolled back'}")
finally:
    path.unlink(missing_ok=True)
