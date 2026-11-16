-- Shared organizational appointments. Do not confuse this with school teams.
-- Populate and reconcile this directory before activating it on the public page.
begin;

create table public.organization_directory (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 200),
  title text not null check (length(trim(title)) between 1 and 200),
  organizational_group text not null check (organizational_group in
    ('founding-team','regional-leadership','communications-team','technology-team','leadership-group','academic-team')),
  region text,
  description text,
  focus jsonb not null default '[]'::jsonb check (jsonb_typeof(focus) = 'array'),
  portrait_path text check (portrait_path is null or portrait_path like '/images/team/%'),
  sort_order integer not null default 0,
  public_visible boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.organization_directory enable row level security;
revoke all on public.organization_directory from public, anon, authenticated;
grant select on public.organization_directory to anon, authenticated;
create policy "Public organizational appointments" on public.organization_directory
  for select to anon, authenticated using (public_visible);

create table private.organization_directory_settings (
  singleton boolean primary key default true check (singleton),
  activated boolean not null default false
);
insert into private.organization_directory_settings(singleton) values (true);
revoke all on private.organization_directory_settings from public, anon, authenticated;

create function public.read_organization_directory() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'activated', (select activated from private.organization_directory_settings where singleton),
    'appointments', (select coalesce(jsonb_agg(to_jsonb(d) order by d.sort_order, d.id), '[]'::jsonb)
      from (select id, name, title, organizational_group, region, description, focus, portrait_path, sort_order, updated_at
        from public.organization_directory where public_visible) d)
  )
$$;
revoke all on function public.read_organization_directory() from public, anon, authenticated;
grant execute on function public.read_organization_directory() to anon, authenticated;

create function public.list_credential_organization_sources() returns setof public.organization_directory
language plpgsql stable security definer set search_path = '' as $$
declare actor uuid := private.require_credential_admin();
begin
  return query select d.* from public.organization_directory d order by d.organizational_group, d.sort_order, d.id;
end;
$$;
revoke all on function public.list_credential_organization_sources() from public, anon, authenticated;
grant execute on function public.list_credential_organization_sources() to authenticated;

-- Only a superme administrator can edit or activate this directory. Keeping
-- activation separate avoids replacing the current public Team with an empty list.
create function public.save_organization_appointment(p_id uuid, p_data jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare actor uuid := private.require_credential_admin(); new_id uuid;
begin
  if p_data is null or jsonb_typeof(p_data) <> 'object' or octet_length(p_data::text) > 20000
    or jsonb_typeof(p_data->'name') is distinct from 'string'
    or jsonb_typeof(p_data->'title') is distinct from 'string'
    or jsonb_typeof(p_data->'organizational_group') is distinct from 'string'
    or (p_data ? 'focus' and jsonb_typeof(p_data->'focus') <> 'array') then
    raise exception 'Invalid organizational appointment' using errcode = '22023';
  end if;
  if p_id is not null and not exists(select 1 from public.organization_directory where id = p_id) then
    raise exception 'Appointment not found' using errcode = '22023';
  end if;
  insert into public.organization_directory(id, name, title, organizational_group, region, description, focus,
    portrait_path, sort_order, public_visible)
  values (coalesce(p_id, gen_random_uuid()), trim(p_data->>'name'), trim(p_data->>'title'), p_data->>'organizational_group',
    p_data->>'region', p_data->>'description', coalesce(p_data->'focus', '[]'::jsonb), p_data->>'portrait_path',
    coalesce((p_data->>'sort_order')::integer, 0), coalesce((p_data->>'public_visible')::boolean, false))
  on conflict (id) do update set name = excluded.name, title = excluded.title, organizational_group = excluded.organizational_group,
    region = excluded.region, description = excluded.description, focus = excluded.focus, portrait_path = excluded.portrait_path,
    sort_order = excluded.sort_order, public_visible = excluded.public_visible, updated_at = now()
  returning id into new_id;
  insert into private.credential_audit_logs(actor, action, details)
    values (actor, 'organization_appointment_saved', jsonb_build_object('appointment_id', new_id));
  return new_id;
end;
$$;
revoke all on function public.save_organization_appointment(uuid,jsonb) from public, anon, authenticated;
grant execute on function public.save_organization_appointment(uuid,jsonb) to authenticated;

create function public.set_organization_directory_active(p_active boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare actor uuid := private.require_credential_admin();
begin
  if p_active is null then raise exception 'Activation value is required' using errcode = '22023'; end if;
  if p_active and not exists (select 1 from public.organization_directory where public_visible) then
    raise exception 'The public directory cannot be activated while empty' using errcode = '22023';
  end if;
  update private.organization_directory_settings set activated = p_active where singleton;
  insert into private.credential_audit_logs(actor, action, details)
    values (actor, 'organization_directory_activation_changed', jsonb_build_object('active', p_active));
end;
$$;
revoke all on function public.set_organization_directory_active(boolean) from public, anon, authenticated;
grant execute on function public.set_organization_directory_active(boolean) to authenticated;

do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime'
      and schemaname = 'public' and tablename = 'organization_directory') then
    alter publication supabase_realtime add table public.organization_directory;
  end if;
end $$;

commit;
