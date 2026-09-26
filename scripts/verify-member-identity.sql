-- Read-only release preflight; does not read or print member data.
do $verify$
declare signature text; relation_name text;
begin
  foreach signature in array array[
    'public.get_my_member_identity()',
    'public.save_my_member_identity(text,text,text,text,integer,text,text)',
    'public.save_my_member_preferences(text,text[],text)',
    'public.change_my_member_school(uuid,uuid)'
  ] loop
    if to_regprocedure(signature) is null then raise exception 'Member Identity migration required: %',signature; end if;
    if not has_function_privilege('authenticated',signature,'EXECUTE') or has_function_privilege('anon',signature,'EXECUTE') then raise exception 'Member Identity RPC permissions invalid: %',signature; end if;
  end loop;
  foreach relation_name in array array['member_profile_details','member_profile_options','member_profile_choices'] loop
    if not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname=relation_name and c.relrowsecurity) then raise exception 'Missing RLS: %',relation_name; end if;
    if has_table_privilege('authenticated','public.'||relation_name,'INSERT,UPDATE,DELETE') then raise exception 'Unexpected direct mutation privilege: %',relation_name; end if;
  end loop;
  if not exists(select 1 from pg_trigger where tgrelid='public.profiles'::regclass and tgname='profiles_guard_member_school_change' and tgenabled <> 'D') then raise exception 'School change guard required'; end if;
end $verify$;
