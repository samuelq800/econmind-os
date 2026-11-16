#!/usr/bin/env python3
"""Run credential SQL tests in isolated, disposable PostgreSQL clusters."""
import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TESTS = [
    "scripts/test-credential-issuance-core.sql",
    "scripts/test-organization-directory.sql",
    "scripts/test-credential-research-realtime.sql",
    "scripts/test-credential-export-jobs.sql",
    "scripts/test-credential-verification-jobs.sql",
]

for index, script in enumerate(TESTS):
    with tempfile.TemporaryDirectory(prefix="em-db-", dir="/tmp") as directory:
        db = str(Path(directory) / "db")
        port = str(55510 + index)
        subprocess.run(["initdb", "-D", db, "-A", "trust", "-U", "postgres"], check=True, stdout=subprocess.DEVNULL)
        subprocess.run(["pg_ctl", "-D", db, "-o", f"-k {directory} -p {port} -c listen_addresses=", "-w", "start"], check=True, stdout=subprocess.DEVNULL)
        try:
            subprocess.run(["psql", "-h", directory, "-p", port, "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-q", "-f", script], cwd=ROOT, check=True, stdout=subprocess.DEVNULL)
        finally:
            subprocess.run(["pg_ctl", "-D", db, "-m", "immediate", "stop"], check=True, stdout=subprocess.DEVNULL)
    print(f"PASS: {script}")
