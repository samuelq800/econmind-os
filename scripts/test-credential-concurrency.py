#!/usr/bin/env python3
"""Exercise concurrent credential issuance using a disposable local PostgreSQL."""
import concurrent.futures
import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ACTOR = "00000000-0000-0000-0000-000000000001"

with tempfile.TemporaryDirectory(prefix="em-cred-", dir="/tmp") as directory:
    db = str(Path(directory) / "db")
    subprocess.run(["initdb", "-D", db, "-A", "trust", "-U", "postgres"], check=True, stdout=subprocess.DEVNULL)
    subprocess.run(["pg_ctl", "-D", db, "-o", f"-k {directory} -p 55488 -c listen_addresses=", "-w", "start"], check=True, stdout=subprocess.DEVNULL)
    command = ["psql", "-h", directory, "-p", "55488", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A"]

    def sql(query):
        return subprocess.run(command + ["-c", query], cwd=ROOT, check=True, text=True, capture_output=True).stdout.strip()

    try:
        subprocess.run(command + ["-f", "scripts/test-credential-issuance-core.sql"], cwd=ROOT, check=True, stdout=subprocess.DEVNULL)
        template = sql(f"set role authenticated; set request.jwt.claim.sub='{ACTOR}'; select public.create_credential_template('PAR','Concurrent','{{}}');")
        batches = []
        for number in range(12):
            key = f"20000000-0000-0000-0000-{number:012d}"
            batch = sql(f"set role authenticated; set request.jwt.claim.sub='{ACTOR}'; select public.create_credential_draft('{key}','{template}','2028-01-01','EconMind Founder Team','[{{\"name\":\"Participant {number}\"}}]');")
            sql(f"set role authenticated; set request.jwt.claim.sub='{ACTOR}'; select public.review_credential_draft('{batch}');")
            sql(f"set role authenticated; set request.jwt.claim.sub='{ACTOR}'; select public.test_attest_credential_preview('{batch}');")
            batches.append(batch)

        def issue(batch):
            return sql(f"set role authenticated; set request.jwt.claim.sub='{ACTOR}'; select public.issue_credential_batch('{batch}');")

        with concurrent.futures.ThreadPoolExecutor(max_workers=12) as pool:
            results = list(pool.map(issue, batches + batches))
        assert results[:12] == results[12:], "Retry returned different certificates"
        count, distinct_numbers, maximum = map(int, sql("select count(*),count(distinct c.certificate_number),max(s.last_sequence) from private.credentials c cross join private.credential_counters s where c.category='PAR' and c.issue_date='2028-01-01' and s.category='PAR' and s.issue_year=2028;").split("|"))
        assert (count, distinct_numbers, maximum) == (12, 12, 12), (count, distinct_numbers, maximum)
        same_name_batches = []
        for number in range(2):
            key = f"30000000-0000-0000-0000-{number:012d}"
            batch = sql(f"set role authenticated; set request.jwt.claim.sub='{ACTOR}'; select public.create_credential_draft('{key}','{template}','2029-01-01','EconMind Founder Team','[{{\"name\":\"Same Person\"}}]');")
            sql(f"set role authenticated; set request.jwt.claim.sub='{ACTOR}'; select public.review_credential_draft('{batch}'); select public.test_attest_credential_preview('{batch}');")
            same_name_batches.append(batch)

        def try_issue(batch):
            query = f"set role authenticated; set request.jwt.claim.sub='{ACTOR}'; select public.issue_credential_batch('{batch}');"
            return subprocess.run(command + ["-c", query], cwd=ROOT, text=True, capture_output=True).returncode

        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
            codes = list(pool.map(try_issue, same_name_batches))
        assert sorted(codes) == [0, 1], codes
        assert sql("select count(*) from private.credentials where recipient_name='Same Person';") == '1'
        original_batch = sql(f"set role authenticated; set request.jwt.claim.sub='{ACTOR}'; select public.create_credential_draft('70000000-0000-4000-8000-000000000001','{template}','2030-01-01','EconMind Founder Team','[{{\"name\":\"Original\"}}]');")
        sql(f"set role authenticated; set request.jwt.claim.sub='{ACTOR}'; select public.review_credential_draft('{original_batch}'); select public.test_attest_credential_preview('{original_batch}'); select public.issue_credential_batch('{original_batch}');")
        original_id = sql(f"select id from private.credentials where batch_id='{original_batch}'")
        sql(f"set role authenticated; set request.jwt.claim.sub='{ACTOR}'; select public.revoke_credential('{original_id}','Correction');")
        replacements = []
        for number in range(2):
            key = f"70000000-0000-4000-8000-{number + 2:012d}"
            query = f"set role authenticated; set request.jwt.claim.sub='{ACTOR}'; select public.create_credential_draft('{key}','{template}','2030-01-01','EconMind Founder Team',jsonb_build_array(jsonb_build_object('name','Replacement {number}','replaces_id','{original_id}')));"
            batch = sql(query)
            sql(f"set role authenticated; set request.jwt.claim.sub='{ACTOR}'; select public.review_credential_draft('{batch}'); select public.test_attest_credential_preview('{batch}');")
            replacements.append(batch)
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
            replacement_codes = list(pool.map(try_issue, replacements))
        assert sorted(replacement_codes) == [0, 1], replacement_codes
        assert sql(f"select count(*) from private.credentials where replaces_id='{original_id}';") == '1'
        # V2 batches must still use the exact V1 issuance transaction and counters.
        subprocess.run(command + ["-f", "supabase/migrations/20261117000000_credential_visual_editor.sql"], cwd=ROOT, check=True, stdout=subprocess.DEVNULL)
        editor_batches = []
        for number in range(6):
            key = f"80000000-0000-0000-0000-{number:012d}"
            query = f"set role authenticated; set request.jwt.claim.sub='{ACTOR}'; select public.save_credential_editor_draft(null,0,'{key}','DIS','V2 Concurrent','2032-01-01','EconMind Founder Team','samuel_qian_v1','[{{\"name\":\"Editor {number}\"}}]','[{{\"title\":\"Certificate\",\"certification_statement\":\"Verified text\"}}]','[{{}}]','[{{}}]')->>'id';"
            batch = sql(query)
            sql(f"set role authenticated; set request.jwt.claim.sub='{ACTOR}'; select public.review_credential_editor_draft('{batch}',1); select public.test_attest_credential_preview('{batch}');")
            editor_batches.append(batch)
        with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
            outputs = list(pool.map(issue, editor_batches + editor_batches))
        assert outputs[:6] == outputs[6:], 'V2 retry returned different certificates'
        count, distinct_numbers, maximum = map(int, sql("select count(*),count(distinct c.certificate_number),max(s.last_sequence) from private.credentials c cross join private.credential_counters s where c.category='DIS' and c.issue_date='2032-01-01' and s.category='DIS' and s.issue_year=2032;").split("|"))
        assert (count, distinct_numbers, maximum) == (6, 6, 6), (count, distinct_numbers, maximum)
        print("PASS: concurrent numbering, idempotency, duplicate-name and replacement races, including V2")
    finally:
        subprocess.run(["pg_ctl", "-D", db, "-m", "immediate", "stop"], check=True, stdout=subprocess.DEVNULL)
