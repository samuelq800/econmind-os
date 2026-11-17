#!/usr/bin/env python3
"""Provision approved private assets using libpq credentials from the environment.

Use only against an explicitly selected database after the migration is applied.
The asset bytes are passed on stdin; they are never written to the repository,
command-line arguments, or terminal output.
"""
import hashlib
import os
import subprocess
import sys
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlsplit

template_path = os.environ.get("CREDENTIAL_PRIVATE_TEMPLATE")
signature_path = os.environ.get("CREDENTIAL_PRIVATE_YALE_SIGNATURE")
database_url = os.environ.get("CREDENTIAL_TARGET_DB_URL")
if not template_path or not signature_path or not database_url:
    raise SystemExit("Set CREDENTIAL_PRIVATE_TEMPLATE, CREDENTIAL_PRIVATE_YALE_SIGNATURE and CREDENTIAL_TARGET_DB_URL.")
template = Path(template_path).read_bytes()
signature = Path(signature_path).read_bytes()
if hashlib.sha256(template).hexdigest() != "591e6c0d67eec9b59ed856f060eca4d3ad5ed8d041b91bf3f67361cf0da6a358":
    raise SystemExit("Template does not match the approved original.")
if hashlib.sha256(signature).hexdigest() != "587af46f950be365383eb8505e77ec072472df5dbc77f6aba734f8ebdf161c53":
    raise SystemExit("Signature does not match the approved original.")
sql = ("begin; insert into private.credential_visual_assets(id,template_html,yale_signature) values "
       f"(true,decode('{template.hex()}','hex'),decode('{signature.hex()}','hex')) "
       "on conflict(id) do update set template_html=excluded.template_html,yale_signature=excluded.yale_signature,updated_at=now(); commit;")
target = urlsplit(database_url)
if target.scheme not in ('postgres', 'postgresql') or target.fragment:
    raise SystemExit("The target must be a PostgreSQL connection URL.")
params = parse_qs(target.query, keep_blank_values=True)
if any(key not in {'host', 'port', 'sslmode', 'sslrootcert', 'connect_timeout', 'application_name'} or len(values) != 1 for key, values in params.items()):
    raise SystemExit("The database URL contains unsupported connection options.")
env = {key: value for key, value in os.environ.items() if not key.startswith('PG')}
env['PGDATABASE'] = unquote(target.path.lstrip('/')) or 'postgres'
host = params.get('host', [target.hostname])[0]
if not host: raise SystemExit("The database host is required.")
env['PGHOST'] = host
port = params.get('port', [str(target.port) if target.port else None])[0]
if port: env['PGPORT'] = port
if target.username: env['PGUSER'] = unquote(target.username)
if target.password: env['PGPASSWORD'] = unquote(target.password)
for option, env_key in [('sslmode','PGSSLMODE'), ('sslrootcert','PGSSLROOTCERT'), ('connect_timeout','PGCONNECT_TIMEOUT'), ('application_name','PGAPPNAME')]:
    if option in params: env[env_key] = params[option][0]
result = subprocess.run(["psql", "-X", "-q", "-v", "ON_ERROR_STOP=1"], input=sql.encode(), env=env,
                        stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, check=False)
if result.returncode:
    print("Private asset provisioning failed; no asset contents were printed.", file=sys.stderr)
    raise SystemExit(result.returncode)
print("Approved private certificate assets provisioned.")
