-- Agreement visibility policies in the original League migration referenced
-- each other.  These helpers are SECURITY DEFINER so policy evaluation never
-- recursively re-enters either RLS-protected relation.

create or replace function public.can_view_agreement(p_agreement_id uuid, p_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public
as $$
  select exists(
    select 1
    from public.international_agreements agreement
    where agreement.id = p_agreement_id
      and (
        agreement.status in ('active', 'completed', 'breached', 'expired')
        or public.is_competition_director(agreement.competition_id, p_user_id)
        or exists(
          select 1 from public.agreement_participants participant
          where participant.agreement_id = agreement.id
            and public.can_view_competition_private_country(agreement.competition_id, participant.country_id, p_user_id)
        )
      )
  )
$$;

drop policy if exists international_agreements_visible_to_participants_or_public on public.international_agreements;
create policy international_agreements_visible_to_participants_or_public
on public.international_agreements for select to authenticated
using (public.can_view_agreement(id, auth.uid()));

drop policy if exists agreement_participants_visible_to_participants on public.agreement_participants;
create policy agreement_participants_visible_to_participants
on public.agreement_participants for select to authenticated
using (public.can_view_agreement(agreement_id, auth.uid()));

grant execute on function public.can_view_agreement(uuid, uuid) to authenticated;
