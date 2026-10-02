\set ON_ERROR_STOP on
-- Disposable PostgreSQL 17 only. Never a production migration/artifact.
\if :apply_deny
create policy world_snapshot_objects_insert_deny on storage.objects as restrictive for insert to anon,authenticated
  with check (bucket_id is distinct from 'world-v2-official-source-v1');
create policy world_snapshot_objects_update_deny on storage.objects as restrictive for update to anon,authenticated
  using (bucket_id is distinct from 'world-v2-official-source-v1') with check (bucket_id is distinct from 'world-v2-official-source-v1');
create policy world_snapshot_objects_delete_deny on storage.objects as restrictive for delete to anon,authenticated
  using (bucket_id is distinct from 'world-v2-official-source-v1');
create policy world_snapshot_buckets_insert_deny on storage.buckets as restrictive for insert to anon,authenticated
  with check (id is distinct from 'world-v2-official-source-v1');
create policy world_snapshot_buckets_update_deny on storage.buckets as restrictive for update to anon,authenticated
  using (id is distinct from 'world-v2-official-source-v1') with check (id is distinct from 'world-v2-official-source-v1');
create policy world_snapshot_buckets_delete_deny on storage.buckets as restrictive for delete to anon,authenticated
  using (id is distinct from 'world-v2-official-source-v1');

-- The same invoker checks are exercised for both ordinary Storage roles.
create function public.check_snapshot_storage_denials() returns void language plpgsql as $$
declare affected integer;
begin
  begin
    insert into storage.objects values ('world-v2-official-source-v1','new.json','x');
    raise exception 'new World object insert unexpectedly allowed';
  exception when insufficient_privilege then null; end;
  update storage.objects set content='changed' where bucket_id='world-v2-official-source-v1';
  get diagnostics affected=row_count;
  if affected<>0 then raise exception 'World object update unexpectedly allowed'; end if;
  update storage.objects set bucket_id='old-avatar-fixture' where bucket_id='world-v2-official-source-v1';
  get diagnostics affected=row_count;
  if affected<>0 then raise exception 'World object move out unexpectedly allowed'; end if;
  delete from storage.objects where bucket_id='world-v2-official-source-v1';
  get diagnostics affected=row_count;
  if affected<>0 then raise exception 'World object delete unexpectedly allowed'; end if;
  begin
    insert into storage.objects values ('world-v2-official-source-v1','frozen.json','changed')
      on conflict(bucket_id,name) do update set content=excluded.content;
    raise exception 'World upsert unexpectedly allowed';
  exception when insufficient_privilege then null; end;
  begin
    update storage.objects set bucket_id='world-v2-official-source-v1' where bucket_id='old-avatar-fixture';
    raise exception 'old object move into World scope unexpectedly allowed';
  exception when insufficient_privilege then null; end;
  begin
    insert into storage.buckets values ('world-v2-official-source-v1',true);
    raise exception 'World bucket insert unexpectedly allowed';
  exception when insufficient_privilege then null; end;
  update storage.buckets set public=false where id='world-v2-official-source-v1';
  get diagnostics affected=row_count;
  if affected<>0 then raise exception 'World bucket update unexpectedly allowed'; end if;
  delete from storage.buckets where id='world-v2-official-source-v1';
  get diagnostics affected=row_count;
  if affected<>0 then raise exception 'World bucket delete unexpectedly allowed'; end if;
  -- Proves the new-scope veto does not downgrade old-scope permissions.
  insert into storage.objects values ('old-avatar-fixture',current_user,'old');
  update storage.objects set content='still allowed' where bucket_id='old-avatar-fixture' and name=current_user;
  get diagnostics affected=row_count;
  if affected<>1 then raise exception 'old-scope update permission changed'; end if;
  delete from storage.objects where bucket_id='old-avatar-fixture' and name=current_user;
  get diagnostics affected=row_count;
  if affected<>1 then raise exception 'old-scope delete permission changed'; end if;
  insert into storage.buckets values (current_user,true);
  update storage.buckets set public=false where id=current_user;
  get diagnostics affected=row_count;
  if affected<>1 then raise exception 'old-scope bucket update permission changed'; end if;
  delete from storage.buckets where id=current_user;
  get diagnostics affected=row_count;
  if affected<>1 then raise exception 'old-scope bucket delete permission changed'; end if;
end $$;
set role anon;
select public.check_snapshot_storage_denials();
reset role;
set role authenticated;
select public.check_snapshot_storage_denials();
reset role;
do $$ begin
  if (select content from storage.objects where bucket_id='world-v2-official-source-v1' and name='frozen.json') is distinct from 'immutable'
    then raise exception 'World source changed'; end if;
end $$;
\else
create role anon nologin nosuperuser nobypassrls;
create role authenticated nologin nosuperuser nobypassrls;
create schema storage;
grant usage on schema storage to public;
create table storage.buckets(id text primary key,public boolean not null);
create table storage.objects(bucket_id text,name text,content text,primary key(bucket_id,name));
alter table storage.buckets enable row level security;
alter table storage.objects enable row level security;
grant select,insert,update,delete on storage.buckets,storage.objects to public;
create policy synthetic_existing_broad_buckets on storage.buckets for all to public using (true) with check (true);
create policy synthetic_existing_broad_objects on storage.objects for all to public using (true) with check (true);
insert into storage.buckets values ('world-v2-official-source-v1',true),('old-avatar-fixture',true);
insert into storage.objects values ('world-v2-official-source-v1','frozen.json','immutable'),('old-avatar-fixture','original.json','old');
\endif
