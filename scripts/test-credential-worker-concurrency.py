#!/usr/bin/env python3
"""Exercise job leases and request idempotency in disposable PostgreSQL."""
import concurrent.futures
import json
import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ACTOR = "00000000-0000-0000-0000-000000000001"

with tempfile.TemporaryDirectory(prefix="em-worker-", dir="/tmp") as directory:
    db = str(Path(directory) / "db")
    subprocess.run(["initdb", "-D", db, "-A", "trust", "-U", "postgres"], check=True, stdout=subprocess.DEVNULL)
    subprocess.run(["pg_ctl", "-D", db, "-o", f"-k {directory} -p 55520 -c listen_addresses=", "-w", "start"], check=True, stdout=subprocess.DEVNULL)
    command = ["psql", "-h", directory, "-p", "55520", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A"]

    def sql(query, check=True):
        result = subprocess.run(command + ["-c", query], cwd=ROOT, check=check, text=True, capture_output=True)
        return result.stdout.strip() if check else result.returncode

    try:
        subprocess.run(command + ["-f", "scripts/test-credential-export-jobs.sql"], cwd=ROOT, check=True, stdout=subprocess.DEVNULL)
        batch = sql("select batch_id from private.credential_export_jobs order by created_at desc limit 1")
        query = f"set role authenticated; set request.jwt.claim.sub='{ACTOR}'; select public.enqueue_credential_export('{batch}','60000000-0000-4000-8000-000000000001');"
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
            jobs = list(pool.map(sql, [query, query]))
        assert jobs[0] == jobs[1], "Concurrent duplicate export request created multiple jobs"
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
            claims = list(pool.map(sql, ["set role service_role; select coalesce(public.claim_credential_export()::text,'null');"] * 2))
        claimed = [json.loads(value) for value in claims if value != "null"]
        assert len(claimed) == 1 and claimed[0]["id"] == jobs[0], claims
        old_token = claimed[0]["claim_token"]
        sql(f"update private.credential_export_jobs set lease_until=now()-interval '1 second' where id='{jobs[0]}'")
        recovered = json.loads(sql("set role service_role; select public.claim_credential_export()::text;"))
        assert recovered["id"] == jobs[0] and recovered["claim_token"] != old_token, "Expired job was not safely reclaimed"
        assert sql(f"set role service_role; select public.heartbeat_credential_export('{jobs[0]}','{old_token}');", check=False) != 0, "Stale worker retained its lease"
        print("PASS: concurrent job claims, idempotent enqueue and expired-lease recovery")
    finally:
        subprocess.run(["pg_ctl", "-D", db, "-m", "immediate", "stop"], check=True, stdout=subprocess.DEVNULL)
