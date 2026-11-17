#!/usr/bin/env python3
"""Run credential SQL tests in isolated, disposable PostgreSQL clusters."""
import subprocess
import os
import tempfile
from pathlib import Path
from urllib.parse import quote

ROOT = Path(__file__).resolve().parent.parent
TESTS = [
    "scripts/test-credential-issuance-core.sql",
    "scripts/test-organization-directory.sql",
    "scripts/test-credential-research-realtime.sql",
    "scripts/test-credential-browser-print.sql",
    "scripts/test-credential-directory-seed.sql",
]

for index, script in enumerate(TESTS):
    with tempfile.TemporaryDirectory(prefix="em-db-", dir="/tmp") as directory:
        db = str(Path(directory) / "db")
        port = str(55510 + index)
        subprocess.run(["initdb", "-D", db, "-A", "trust", "-U", "postgres"], check=True, stdout=subprocess.DEVNULL)
        subprocess.run(["pg_ctl", "-D", db, "-o", f"-k {directory} -p {port} -c listen_addresses=", "-w", "start"], check=True, stdout=subprocess.DEVNULL)
        try:
            subprocess.run(["psql", "-h", directory, "-p", port, "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-q", "-f", script], cwd=ROOT, check=True, stdout=subprocess.DEVNULL)
            if script.endswith("test-credential-browser-print.sql"):
                template = Path('/Users/samuel/Documents/Codex/2026-11-16/referenced-chatgpt-conversation-this-is-an/outputs/EconMind_Certificate_Integration_Handoff/EconMind_League_Yale_Founding_Leadership_Certificate.html')
                signature = Path('/Users/samuel/.codex/private/econmind-credentials/signatures/yale-chen.png')
                if template.exists() and signature.exists():
                    env = {**os.environ, 'CREDENTIAL_PRIVATE_TEMPLATE': str(template), 'CREDENTIAL_PRIVATE_YALE_SIGNATURE': str(signature),
                           'CREDENTIAL_TARGET_DB_URL': f'postgresql://postgres@/postgres?host={quote(directory)}&port={port}'}
                    subprocess.run(['python3', 'scripts/provision-credential-print-assets.py'], cwd=ROOT, env=env, check=True, stdout=subprocess.DEVNULL)
                    sizes = subprocess.check_output(['psql','-h',directory,'-p',port,'-U','postgres','-At','-c',
                        'select octet_length(template_html),octet_length(yale_signature) from private.credential_visual_assets where id'], text=True).strip()
                    if sizes != f'{template.stat().st_size}|{signature.stat().st_size}': raise RuntimeError('Private asset provisioning failed')
        finally:
            subprocess.run(["pg_ctl", "-D", db, "-m", "immediate", "stop"], check=True, stdout=subprocess.DEVNULL)
    print(f"PASS: {script}")
