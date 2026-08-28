# EconMind OS — Phase 2 Navigation / Information Architecture Implementation

**Status:** Complete
**Scope:** Navigation and discoverability only
**Compatibility posture:** Preserve-first. No route relocation, simulation change, data change, permission change, or Supabase migration is part of this phase.

## 1. Delivered primary navigation

The global navigation now has exactly eight top-level destinations, in the agreed order:

1. Explore
2. Learn
3. Lab
4. Simulation
5. League
6. Teams
7. Community & Legal
8. Workspace

The EconMind wordmark remains the Home link rather than becoming a ninth product destination. Role-specific destinations, such as Professor Studio and administration, remain available through the account menu for eligible users and are intentionally not promoted to the normal public navigation.

## 2. Canonical navigation source

`lib/platform/feature-flags.ts` now owns the typed `NAVIGATION_SECTIONS` configuration. It is the single source for:

- desktop primary navigation and its contextual menus;
- mobile primary navigation and its grouped child links;
- active-state resolution;
- footer primary navigation; and
- compatibility exports consumed by existing code.

Every destination continues to use its established URL. The new hierarchy is therefore an information-architecture regrouping, not a URL migration.

## 3. Functional regrouping

| Top-level destination | Existing destinations surfaced |
| --- | --- |
| Explore | Explore, Daily Brief, Cases |
| Learn | Models, Model Practice, Model Composer |
| Lab | Economic Sandbox, Policy Lab, Evidence Lab, EconBench, Experiments, Mechanism Arena, Activity Library |
| Simulation | Existing `/simulation` entry only; its own `SimulationNavigation` remains the secondary navigation |
| League | Existing League home, schools, season, standings and League information |
| Teams | Public EconMind Team page and existing League team management |
| Community & Legal | Existing community discussions, questions, events and organisation/About information |
| Workspace | Dashboard, Integrated Workspace, Library and Profile |

`/league/teams` remains a League-context management page, but it is now also exposed through the first-level Teams destination. It has not been merged with the public Team page, because the two surfaces have different permissions and purposes.

## 4. Protected compatibility boundaries retained

- The entire `/simulation/*` domain keeps its routes, labels, secondary navigation, equations, world rules, scoring, role logic, permission model and Realtime behaviour unchanged.
- League routes, school/team membership, attempts, standings and role-aware flows remain unchanged.
- Community/Agora routes retain their current independent content and navigation.
- `/profile/[username]` remains a public editorial profile route; the root `/profile` page remains a protected personal Workspace route.
- The account/avatar menu remains a quick route to the Workspace dashboard and personal library, matching the visual entry users already know.
- No Supabase schema, migration, RLS policy, RPC, score, or economics-engine change was made.

## 5. Community & Legal boundary note

The working branch contains the active Community/Agora routes but does not contain standalone `/legal`, `/privacy`, `/terms`, or `/community-guidelines` routes. They were therefore not fabricated during this IA phase. The Community & Legal container currently surfaces the live Community and About destinations; any restoration of the historical legal document layer must be handled as a separate content-and-governance integration so its forms, consent records and administrator workflows are restored together rather than represented by empty links.

## 6. Regression coverage

`tests/navigation-information-architecture.test.ts` verifies:

- the exact eight top-level labels and order;
- identical desktop/mobile conceptual taxonomy;
- every configured link maps to a current page route;
- Simulation remains a direct first-level destination with no replacement submenu;
- `/league/teams` resolves to Teams instead of receiving a duplicate League active state; and
- the global shell remains singular while the protected Simulation navigation labels remain present.

## 7. Deliberately deferred work

The following remains outside Phase 2 because changing it without dedicated regression coverage could affect behaviour:

- extracting shared League/Simulation controllers;
- changing Supabase adapters, types, permission helpers or Realtime subscriptions;
- changing database schema, RLS or stored data;
- changing simulation, League or community internals;
- reconnecting historical legal/governance pages that are absent from this working branch; and
- performance refactors that could alter interactive freshness or saved-work timing.
