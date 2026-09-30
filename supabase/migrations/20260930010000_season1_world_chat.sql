-- Chat updates must not rebuild the full lobby or broaden profile visibility.
create or replace function public.get_world_preseason_world_messages(p_message_limit integer default 100)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  perform public.world_preseason_require_participant();
  return coalesce((
    select jsonb_agg(item order by created_at, id)
    from (
      select m.id, m.created_at, jsonb_build_object(
        'id', m.id, 'content', m.content, 'messageType', m.message_type,
        'metadata', m.metadata, 'createdAt', m.created_at, 'deletedAt', m.deleted_at,
        'authorName', coalesce(p.display_name, 'Participant'), 'authorId', m.author_user_id
      ) as item
      from public.world_preseason_chat_messages m
      join public.world_preseason_chat_channels c on c.id = m.channel_id
      join public.world_preseason_seasons s on s.id = c.season_id
      left join public.profiles p on p.user_id = m.author_user_id
      where s.code = 'season-1' and c.channel_type = 'LOBBY'
      order by m.created_at desc, m.id desc
      limit greatest(1, least(coalesce(p_message_limit, 100), 100))
    ) recent
  ), '[]'::jsonb);
end;
$$;
revoke all on function public.get_world_preseason_world_messages(integer) from public, anon;
grant execute on function public.get_world_preseason_world_messages(integer) to authenticated;

-- Existing RLS still controls delivery. The frontend also polls after outages.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public'
        and tablename = 'world_preseason_chat_messages'
    ) then
    alter publication supabase_realtime add table public.world_preseason_chat_messages;
  end if;
end;
$$;
