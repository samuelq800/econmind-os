# Twelve Nations: Interconnected World Economy

## Purpose

This is the default long-running EconMind League scenario. It is separate from
the legacy four-country world, so existing competitions and round history stay
unchanged. The scenario begins with twelve balanced fictional economies and
four linked commodity markets: energy, food, manufactured goods and technology
services.

## Configuration source of truth

- `lib/economics/world/countries.ts` is the maintained, versioned source for
  country profiles and the deterministic browser/Edge settlement engine.
- `supabase/migrations/20260729040000_twelve_country_world_league.sql` creates
  the published database scenario, twelve editable template rows, immutable
  competition snapshots and the open-registration default competition.
- A competition copies the country template into
  `competition_countries.immutable_template_snapshot`. Editing a later
  template cannot rewrite a world that has already begun.

## Access model

- Any registered user can see public country profiles and released results.
- In the default open-registration world, a registered user can claim an open
  country role. Teachers may later connect countries to school teams.
- Draft policy choices, numerical sensitivities and unreleased country
  packages remain visible only to country-role holders and directors.
- Platform administrators can create scenarios. Platform administrators and
  users granted `scenario_editor_access` can edit an authorised scenario.

## Fiscal rule

Fiscal deficits are legal. They are shown as a fiscal outlook rather than an
“over-committed” blocker. Income and business tax choices affect the following
quarter’s fiscal capacity; deficits add delayed debt, interest, confidence and
currency pressure. Land, energy, reserves and administrative capacity remain
real shared-resource constraints.

## Running it

The seeded competition is intentionally untimed. A director manually opens the
appropriate round phase, waits for each country to finalise its four
institutional drafts, runs deterministic world clearing, reviews the results,
then publishes them. No scheduled server or paid service is required.

## Safe rollout order

1. Apply migration `20260729030000_fix_agreement_participant_rls_recursion.sql`.
2. Apply migration `20260729040000_twelve_country_world_league.sql`.
3. Deploy the Edge Function `process-league-world-round` from this repository.
4. Publish the static frontend to GitHub Pages.

The browser receives only the Supabase publishable/anon key. The service role
key is used only in the protected Edge Function environment.
