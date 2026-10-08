\set ON_ERROR_STOP on
-- Disposable PostgreSQL only. No production connection allowed in CI.
create role anon;
create role authenticated;
create role service_role;
\ir ../supabase/migrations/20261008120000_stable_email_codes.sql

do $$
declare s text := repeat('a',64); peer text := repeat('b',64); r jsonb; first_expiry text; l uuid; i integer;
begin
  r := public.stable_email_code_send(s,'signup',repeat('x',40),repeat('h',40));
  assert r->>'status'='ready'; first_expiry := r->>'expires_at';
  assert public.stable_email_code_send(s,'signup',repeat('y',40),repeat('j',40))->>'status'='limited';
  update private.stable_email_codes set last_sent_at=last_sent_at-interval '61 seconds' where subject=s;
  r := public.stable_email_code_send(s,'signup',repeat('y',40),repeat('j',40));
  assert r->>'code_cipher'=repeat('x',40), 'resend rotated code';
  assert r->>'expires_at'=first_expiry, 'resend extended expiry';
  r := public.stable_email_code_claim(s,peer); l := (r->>'lease')::uuid;
  assert r->>'status'='ready';
  assert public.stable_email_code_claim(s,peer)->>'status'='busy';
  assert public.stable_email_code_send(s,'signup',repeat('y',40),repeat('j',40))->>'status'='busy';
  assert not public.stable_email_code_finish(s,gen_random_uuid(),true), 'foreign lease accepted';
  assert public.stable_email_code_finish(s,l,false);
  for i in 2..10 loop
    r := public.stable_email_code_claim(s,peer);
    assert public.stable_email_code_finish(s,(r->>'lease')::uuid,false);
  end loop;
  update private.stable_email_codes set last_sent_at=last_sent_at-interval '61 seconds' where subject=s;
  perform public.stable_email_code_send(s,'signup',repeat('y',40),repeat('j',40));
  assert public.stable_email_code_claim(s,peer)->>'status'='limited', 'resend reset attempts';
  update private.stable_email_codes set expires_at=clock_timestamp()-interval '1 second' where subject=s;
  assert public.stable_email_code_claim(s,peer)->>'status'='invalid';
  r := public.stable_email_code_send(s,'signup',repeat('y',40),repeat('j',40));
  assert r->>'code_cipher'=repeat('y',40), 'expired code retained';
  r := public.stable_email_code_claim(s,peer);
  assert public.stable_email_code_finish(s,(r->>'lease')::uuid,true);
  assert public.stable_email_code_claim(s,peer)->>'status'='invalid', 'code used twice';
  assert (select code_cipher='' and cardinality(hash_ciphers)=0 from private.stable_email_codes where subject=s);
  for i in 1..31 loop r := public.stable_email_code_claim(repeat('c',64),repeat('d',64)); end loop;
  assert r->>'status'='limited', 'peer rate limit bypassed';
  assert not has_function_privilege('anon','public.stable_email_code_send(text,text,text,text)','execute');
  assert not has_function_privilege('authenticated','public.stable_email_code_claim(text,text)','execute');
  assert not has_function_privilege('anon','public.stable_email_code_finish(text,uuid,boolean)','execute');
  assert has_function_privilege('service_role','public.stable_email_code_claim(text,text)','execute');
  assert not has_table_privilege('anon','private.stable_email_codes','select');
  assert not has_table_privilege('authenticated','private.stable_email_codes','select');
end $$;
set role service_role;
select public.stable_email_code_claim(repeat('e',64),repeat('f',64))->>'status'='legacy' as service_rpc_works;
reset role;
-- Retest the migration to prove safe retry/idempotency; no codes deleted.
\ir ../supabase/migrations/20261008120000_stable_email_codes.sql
