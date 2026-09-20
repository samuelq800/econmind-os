begin;

-- Email addresses are deliberately exposed only through this admin-checked RPC.
create or replace function public.admin_mail_recipients(p_after uuid default null)
returns table(user_id uuid, display_name text, email text, school_id uuid, school_name text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not coalesce(public.is_platform_admin(auth.uid()), false) then
    raise exception 'Platform administrator access required' using errcode = '42501';
  end if;
  return query
    select p.user_id, p.display_name, u.email::text, p.school_id, s.name
    from public.profiles p join auth.users u on u.id = p.user_id
    left join public.schools s on s.id = p.school_id
    where (p_after is null or p.user_id > p_after)
      and u.email is not null and u.email <> '' and u.deleted_at is null
    order by p.user_id limit 200;
end;
$$;
revoke all on function public.admin_mail_recipients(uuid) from public, anon;
grant execute on function public.admin_mail_recipients(uuid) to authenticated;
commit;
