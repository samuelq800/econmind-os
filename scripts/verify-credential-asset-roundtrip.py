#!/usr/bin/env python3
"""Check private-asset size and hashes through the linked DB; always rolls back."""
import base64
import hashlib
import os
import re
import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TEMPLATE = Path('/Users/samuel/Documents/Codex/2026-11-16/referenced-chatgpt-conversation-this-is-an/outputs/EconMind_Certificate_Integration_Handoff/EconMind_League_Yale_Founding_Leadership_Certificate.html')
SIGNATURE = Path('/Users/samuel/.codex/private/econmind-credentials/signatures/yale-chen.png')
EXPECTED = ['591e6c0d67eec9b59ed856f060eca4d3ad5ed8d041b91bf3f67361cf0da6a358', '587af46f950be365383eb8505e77ec072472df5dbc77f6aba734f8ebdf161c53']
assets = [path.read_bytes() for path in (TEMPLATE, SIGNATURE)]
if [hashlib.sha256(asset).hexdigest() for asset in assets] != EXPECTED:
    raise SystemExit('Private asset integrity check failed.')
encoded = [base64.b64encode(asset).decode('ascii') for asset in assets]
sql = f"""begin;
set local statement_timeout='30s';
create temporary table credential_asset_probe(template bytea,signature bytea) on commit drop;
insert into credential_asset_probe values(decode('{encoded[0]}','base64'),decode('{encoded[1]}','base64'));
do $check$ begin
  if not exists(select 1 from credential_asset_probe where
    encode(extensions.digest(template,'sha256'),'hex')='{EXPECTED[0]}' and
    encode(extensions.digest(signature,'sha256'),'hex')='{EXPECTED[1]}') then
    raise exception 'Private asset checksum mismatch';
  end if;
end $check$;
rollback;
select to_regclass('pg_temp.credential_asset_probe') is null as rolled_back;
"""
with tempfile.NamedTemporaryFile(mode='w', prefix='credential-asset-probe-', suffix='.sql', delete=False) as file:
    path = Path(file.name)
    os.chmod(path, 0o600)
    file.write(sql)
try:
    result = subprocess.run([str(ROOT / 'node_modules/.bin/supabase'),'db','query','--linked','--file',str(path),'--output','json'],
                            cwd=ROOT,capture_output=True,text=True,timeout=120,check=False)
    if result.returncode or not re.search(r'"rolled_back"\s*:\s*true',result.stdout):
        raise SystemExit('Private asset roundtrip failed or rollback could not be verified; response withheld.')
    print('PASS: private original template and signature roundtrip and rollback verified')
finally:
    path.unlink(missing_ok=True)
