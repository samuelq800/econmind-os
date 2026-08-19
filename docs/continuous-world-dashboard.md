# Continuous world dashboard

## Purpose

Single reference for the continuous-world dashboard UI: what it renders, how
its sign-in gate behaves, and the desktop scrollability contract that
`tests/continuous-world-dashboard.test.ts` guards.

## Current file layout

| Area | File | Notes |
| --- | --- | --- |
| Dashboard UI | `components/world/continuous-world-dashboard.tsx` | Main export `ContinuousWorldDashboard`; **superseded pre-#35 UI, not mounted by any route** (see Routing reality) |
| Gate test | `tests/continuous-world-dashboard.test.ts` | Recreated minimal suite (2 tests): timeline scrollability + core sections present |
| Scrollbar hook | `app/globals.css` | `.scroll-slim` utility (3px effective thumb) — intentionally **not** applied to the history timeline grid |

## Routing reality

Actual mounts in this checkout:

- `/world` → redirect → `/simulation/world` → `WorldSimulationOverview` (12-country, six offices per country).
- `/league/world` → `WorldExperience` → the same `WorldSimulationOverview`.
- This overview **is** the current continuous-world UI: PR #35 (commit
  `a4646fc`, "Upgrade continuous world governance") replaced the pre-#35
  dashboard at `/league/world` with the world-governance system.

Consequences for `ContinuousWorldDashboard`:

- It is the **pre-#35 interface** for the same continuous-world backend and
  stays in the tree as legacy reference only. Do not wire it back into the
  world entrypoints — `tests/world-entrypoint.test.ts` explicitly pins
  `world-experience` to render `WorldSimulationOverview` and *not*
  `ContinuousWorldDashboard`. Mounting it there breaks that guard test and
  reverts the #35 decision.
- Navigation visibility for the continuous world is feature-flagged with
  `NEXT_PUBLIC_ENABLE_CONTINUOUS_WORLD` (see
  `docs/CONTINUOUS-WORLD-DEPLOYMENT.md`); the flag is not permission control —
  RLS and server procedures remain the security boundary.

## Render structure

`ContinuousWorldDashboard` (line ~2090) resolves auth and world state first,
then renders a `max-w-[1700px]` page containing, in order of definition:

- `WorldHeader` / `HeaderCell` — world status strip
- `MapCanvas` — "Fictional World Map"
- `RankingPanel` — "Rolling world ranking"
- `CountryAndRolePanel` — "Country & roles"
- `PolicyDesk` / `ScopedPolicyDesk` — "Policy desk"
- `ContractDesk` — "Trade & contracts"
- `WorldParticipationSummary` — "Your world access"
- `CountrySelector` — "Choose a country"
- `CountryRoleWorkspace` — "Country access"
- `CountryControlWorkspace` — "National control room"
- `CountryMetrics` — "Current national state"
- `Timeline` — "World history & Replay" (scrollable list, `max-h-60`)
- `TeacherShockPanel` — "World supervisor control"

## Sign-in gate behavior

The component gates on `useAuth()` directly, before any data fetch:

- **No user** → centered card "Sign in before entering the world." with a
  sign-in button (`openAuth("sign-in")`); copy notes that an individual
  account, League registration, and an approved school Team are required
  before a country can be controlled.
- **Loading, no world yet** → spinner state.
- **No world record** → "World launch is waiting for its calibrated state."
  card; the page never substitutes a fake demonstration for missing data.

## Desktop scrollability contract

The "World history & Replay" card caps its list at `max-h-60` with
`overflow-y-auto`. The grid must keep the **default** (visible, ~11px)
scrollbar:

```tsx
<div className="mt-4 grid max-h-60 gap-2 overflow-y-auto pr-1">
```

Do not re-apply `scroll-slim` there. With the slim utility the thumb renders
at ~3px and is effectively invisible on desktop, hiding that the list
continues below the fold (first ~3 of up to 40 items visible). Other slim or
hidden-scrollbar usages elsewhere in the app are unaffected — this contract
covers only this timeline grid.

## Regression check

```powershell
npx vitest run tests/continuous-world-dashboard.test.ts
```

Covers: the scrollable timeline grid exists and carries no `scroll-slim`
override, and the core section headings (map, ranking, country & roles,
policy desk, trade & contracts, supervisor control) are present.

## Notes

- This document reflects the fork checkout (`e15f046`) and the routing state
  above. If the component is ever deliberately re-introduced at a dedicated
  route (not the world entrypoints), re-verify the gate states and update the
  routing section.
