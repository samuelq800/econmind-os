-- Explicit owner request: all signed-in accounts confirm platform AND World.
-- No backfill, bulk acceptance, user/profile/role/team update, or Auth setting change.
begin;
create schema if not exists private;
create or replace function private.current_policy_release_documents()
returns table(document_key text, document_version text, document_path text, source_sha256 text, acknowledgement_action text)
language sql immutable set search_path = '' as $$ values
 ('terms','2.0','/legal/terms/','54df00663f3cfd547bf10101a17ee6b52398773e969f4fef60299cd02de45e64','agree'),
 ('privacy','2.0','/legal/privacy/','714bf97a31fce78e85863a962d2623e897177f6c9c07a8dbe1b0dc2d925a2dd9','read'),
 ('community-guidelines','2.0','/legal/community-guidelines/','f6ca6a40f8d92ad358b80df1cd3bd3b47b942abe67e541edbcc86486da1710b2','agree'),
 ('integrity','2.0','/legal/integrity/','4460c4da668961c86188de1ddaae73a9bee53c0d16efd609646d06ced00cf9f4','agree'),
 ('intellectual-property','2.0','/legal/intellectual-property/','aae80a14a1e585f37bd8b6755be86f482c4ef5b4d5b87d3dbce5d015a9b98909','agree'),
 ('world/about','2026-10-21','/legal/world/about/','78b02521e95a2f52ecb5b19b481c5f78667b73d40895dba6c5f427c8332b36f9','read'),
 ('world/terms','2026-10-21','/legal/world/terms/','e85ad7a811ba09b6a4d06d120e0b8c0f228ec505ee2842ccdbb32592ae8352bc','agree'),
 ('world/privacy','2026-10-21','/legal/world/privacy/','18507ccb4d724fe9811aaa10d425d4f5833c1de0cd60e37c20139a9e3e2a81d7','read')
$$;
revoke all on function private.current_policy_release_documents() from public, anon, authenticated;

create table if not exists public.policy_acknowledgement_records (
 user_id uuid not null references public.profiles(user_id) on delete cascade,
 release_id text not null,
 document_key text not null,
 document_version text not null,
 document_path text not null,
 source_sha256 text not null check(source_sha256 ~ '^[a-f0-9]{64}$'),
 acknowledgement_action text not null check(acknowledgement_action in ('read','agree')),
 acknowledged_at timestamptz not null default now(),
 primary key(user_id, release_id, document_key)
);
alter table public.policy_acknowledgement_records enable row level security;
revoke all on public.policy_acknowledgement_records from public, anon, authenticated;
grant select on public.policy_acknowledgement_records to authenticated;
drop policy if exists policy_acknowledgements_select_own on public.policy_acknowledgement_records;
create policy policy_acknowledgements_select_own on public.policy_acknowledgement_records for select to authenticated using(user_id = (select auth.uid()));

-- Keep the previous pair active solely for already-cached registration clients.
-- It never satisfies the new release receipt; historical rows remain unchanged.
insert into public.legal_document_versions(document_type,version,effective_date,require_reacceptance,status,change_summary)
values ('terms','2.0',date '2026-10-21',true,'active','Published R2 Terms; explicit new account confirmation.'),
 ('privacy','2.0',date '2026-10-21',true,'active','Published R2 Privacy Notice; explicit acknowledgement, not blanket optional processing consent.')
on conflict(document_type,version) do update set require_reacceptance=true,status='active';

create or replace function public.get_my_policy_acknowledgement_status(p_expected_user_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare account_id uuid := auth.uid(); complete boolean;
begin
 if account_id is null or p_expected_user_id is distinct from account_id or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then
  raise exception 'Signed-in individual account required' using errcode='42501';
 end if;
 select count(*)=8 into complete from private.current_policy_release_documents() d
 join public.policy_acknowledgement_records r on r.user_id=account_id and r.release_id='2026-10-21-v2'
  and r.document_key=d.document_key and r.document_version=d.document_version and r.source_sha256=d.source_sha256
  and r.document_path=d.document_path and r.acknowledgement_action=d.acknowledgement_action;
 return jsonb_build_object('user_id',account_id,'release_id','2026-10-21-v2','complete',complete);
end $$;

create or replace function public.acknowledge_policy_release(p_expected_user_id uuid,p_release_id text,p_acknowledgements jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare account_id uuid := auth.uid();
begin
 if account_id is null or p_expected_user_id is distinct from account_id or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then
  raise exception 'Signed-in individual account required' using errcode='42501';
 end if;
 if p_release_id is distinct from '2026-10-21-v2' then raise exception 'Policy release is not current'; end if;
 if p_acknowledgements is null or jsonb_typeof(p_acknowledgements) <> 'object' then raise exception 'Explicit confirmation of all eight documents required'; end if;
 if (select count(*) from jsonb_object_keys(p_acknowledgements)) <> 8 or exists(
  select 1 from private.current_policy_release_documents() d where p_acknowledgements->d.document_key is distinct from 'true'::jsonb
 ) then raise exception 'Explicit confirmation of all eight documents required'; end if;
 insert into public.policy_acknowledgement_records(user_id,release_id,document_key,document_version,document_path,source_sha256,acknowledgement_action)
 select account_id,p_release_id,document_key,document_version,document_path,source_sha256,acknowledgement_action from private.current_policy_release_documents()
 on conflict(user_id,release_id,document_key) do nothing;
 -- Only the explicit v2 Terms/Privacy checkboxes create these new pair receipts.
 insert into public.user_consents(user_id,document_type,document_version) values(account_id,'terms','2.0'),(account_id,'privacy','2.0')
 on conflict(user_id,document_type,document_version) do nothing;
 return public.get_my_policy_acknowledgement_status(account_id);
end $$;
revoke all on function public.get_my_policy_acknowledgement_status(uuid),public.acknowledge_policy_release(uuid,text,jsonb) from public, anon, authenticated;
grant execute on function public.get_my_policy_acknowledgement_status(uuid),public.acknowledge_policy_release(uuid,text,jsonb) to authenticated;
notify pgrst, 'reload schema';
commit;
