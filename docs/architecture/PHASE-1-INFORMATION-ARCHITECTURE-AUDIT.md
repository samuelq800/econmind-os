# EconMind OS — Phase 1 Information Architecture & Architecture Audit

**Status:** Audit complete — Phase 2 navigation implementation is documented separately in `PHASE-2-NAVIGATION-IMPLEMENTATION.md`.
**Scope:** Information architecture, navigation, component reuse, service boundaries, permissions and Realtime review
**Implementation posture:** Preserve-first. This document proposes no route removal, database redesign, permission change, or product-behaviour change.

## 1. Executive summary

EconMind OS already contains the capability required by the target information architecture. The central migration task is therefore **not to rebuild pages**, but to make the existing capability easier to find through one typed, shared navigation configuration while preserving established URLs and protected simulation behaviour.

The audit found four material areas for a later implementation phase:

1. **Navigation is defined in three places.** `PLATFORM_NAVIGATION`, `PRIMARY_NAVIGATION`, and `MOBILE_NAVIGATION_GROUPS` describe overlapping products with different labels and groupings. Desktop and mobile can drift.
2. **League and Simulation share substantial implementation.** Many `/simulation/*` pages already render League components with different route labels. Their outer routes are still valuable compatibility and product boundaries; they should remain, while duplicated controllers can be extracted only after regression coverage.
3. **The public Team page and League Team management are different products.** `/team` is the public organisation and leadership directory; `/league/teams` is the school/team management surface. Both must remain under the new `Teams` container.
4. **Competition Realtime refreshes full snapshots twice.** League and legacy Simulation competition surfaces both listen to the same events and then reload the complete competition snapshot. It is a safe performance-review candidate, but only after observable behaviour is covered by tests.

No existing legal route was found. The target `Community & Legal` navigation container can safely group existing Community surfaces now; introducing new legal pages or legal copy is **out of scope for this audit** and requires a separate approved content change.

## 2. Non-negotiable protection boundaries

The following are protected in every future phase unless a separate explicit change request overrides them:

- Every existing URL continues to resolve. A route may gain a navigation wrapper or be marked as a compatible entry point, but it must not disappear.
- `/simulation/*` remains a first-level product family. Its current secondary navigation, models, equations, scoring, permissions, Realtime behaviour, simulation states and user content are not redesigned as part of IA work.
- `/league/*`, school membership, invitations, challenge attempts, standings, Season/coming-soon state, World logic and role assignment retain their existing authority and data behaviour.
- `/team` remains the public Team/leadership presentation; `/league/teams` remains League team management.
- Community/Agora routes retain their current pages and links. Community & Legal is a grouping, not a replacement product.
- RLS and server/RPC authority remain final. Client-side access predicates may be consolidated only when the outcome is unchanged and covered by regression tests.
- GitHub Pages/static export remains supported: no server-only navigation dependency, unbounded image optimisation requirement, or new paid/always-on infrastructure.
- No destructive Supabase migration, data rewrite, table replacement, or permission redesign is authorised by this audit.

## 3. Target top-level navigation (implementation target, not yet applied)

The requested target order is:

1. **Explore** — Daily Brief, Cases, Explore.
2. **Learn** — Models, explanations, learning progress and practice.
3. **Lab** — Sandbox, Policy Lab, Evidence Lab, EconBench, Experiments and Mechanism Arena.
4. **Simulation** — existing first-level Simulation surface, unchanged internally.
5. **League** — existing cross-school challenge, school, standings, season and World surfaces.
6. **Teams** — public Team directory plus League team management.
7. **Community & Legal** — existing Community/Agora surfaces plus existing legal surfaces if/when present.
8. **Workspace** — dashboard, profile, library, saved runs and personal progress.

`Home` remains the brand/home link rather than a numbered product section. Admin and professor destinations remain role-gated utilities rather than public primary navigation entries.

## 4. Route inventory and preservation classification

### Classification legend

| Classification | Meaning |
| --- | --- |
| `KEEP` | Existing public route remains a direct destination. |
| `MOVE-IN-NAV-ONLY` | The page stays at the same URL; only its discoverability/group changes. |
| `REUSE` | Existing implementation is shared; retain wrapper and route-specific labels/links. |
| `WRAPPER` | Compatibility route or product boundary that delegates to a shared component. |
| `REDIRECT-ONLY-if-safe` | Existing redirect remains, without replacing linked destinations. |
| `PROTECTED` | Behaviour, internal navigation, permissions and data flow cannot change in IA work. |
| `ADMIN/ROLE-GATED` | Retained but deliberately absent from standard public navigation. |

### Shared, Explore, Learn, Lab and Workspace

| Existing paths | Target area | Classification | Canonical/navigation treatment | Notes |
| --- | --- | --- | --- | --- |
| `/` | Home | `KEEP` | Brand/home link | Preserve current homepage content and visual identity. |
| `/explore` | Explore | `MOVE-IN-NAV-ONLY` | Explore landing | Existing gateway. |
| `/daily-brief`, `/daily-brief/read`, `/daily-brief/archive`, `/daily-brief/[briefSlug]` | Explore | `MOVE-IN-NAV-ONLY` | Explore → Daily Brief | Preserve editorial flow and archive/read URLs. |
| `/cases`, `/cases/history`, `/cases/[slug]` | Explore | `MOVE-IN-NAV-ONLY` | Explore → Cases | Keep saved/history behaviour. |
| `/models`, `/models/[slug]` | Learn | `MOVE-IN-NAV-ONLY` | Learn → Models | Model index and generic model routes remain. |
| `/models/ad-as`, `/models/composer`, `/models/cournot`, `/models/elasticity`, `/models/externalities`, `/models/is-lm`, `/models/lorenz-gini`, `/models/monopoly`, `/models/phillips-curve`, `/models/policy`, `/models/ppf`, `/models/price-controls`, `/models/prisoners-dilemma`, `/models/repeated-games`, `/models/solow-growth`, `/models/supply-demand` | Learn | `KEEP` | Learn → Models | Preserve each dedicated teaching model and its calculation behaviour. |
| `/models/practice` | Learn | `MOVE-IN-NAV-ONLY` | Learn → Practice | Preserve answer-checking, progress and formula display behaviour. |
| `/sandbox`, `/policy-lab` | Lab | `MOVE-IN-NAV-ONLY` | Lab → Sandbox / Policy Lab | Browser-side economic calculation remains local and realtime. |
| `/econbench`, `/econbench/[challengeId]` | Lab | `MOVE-IN-NAV-ONLY` | Lab → EconBench | Preserve challenge records and assessment flow. |
| `/mechanism-arena`, `/mechanism-arena/[mechanismId]` | Lab | `MOVE-IN-NAV-ONLY` | Lab → Mechanism Arena | Existing standalone entry stays valid. |
| `/activities` | Lab | `WRAPPER` | Lab → Activities/Mechanism Arena entry | Keep as an existing alternate discovery route. |
| `/experiments`, `/experiments/builder`, `/experiments/history`, `/experiments/join`, `/experiments/report`, `/experiments/run`, `/experiments/teacher` | Lab | `MOVE-IN-NAV-ONLY` | Lab → Experiments | Teacher and participant permissions stay unchanged. |
| `/research`, `/research/[projectId]` | Lab | `MOVE-IN-NAV-ONLY` | Lab → Evidence Lab | Data upload remains governed by existing feature flag. |
| `/dashboard`, `/workspace`, `/library`, `/profile`, `/profile/[username]` | Workspace | `MOVE-IN-NAV-ONLY` | Workspace menu | Dashboard/personal data and public profile must remain distinguishable. |
| `/professor`, `/professor/projects` | Workspace | `ADMIN/ROLE-GATED` | Account/role menu, not public top-level | Preserve Professor role boundary. |
| `/about` | Community & Legal | `MOVE-IN-NAV-ONLY` | Community & Legal → About | Current public organisation/About page. |
| `/zh` | Shared | `KEEP` | Locale-compatible entry | Preserve existing locale route and content. |

### Community and Legal

| Existing paths | Target area | Classification | Canonical/navigation treatment | Notes |
| --- | --- | --- | --- | --- |
| `/discussions`, `/discussions/[id]` | Community & Legal | `MOVE-IN-NAV-ONLY` | Community → Discussions | Preserve public Community conversations. |
| `/questions`, `/questions/[slug]` | Community & Legal | `MOVE-IN-NAV-ONLY` | Community → Questions | Preserve question detail URLs. |
| `/events` | Community & Legal | `MOVE-IN-NAV-ONLY` | Community → Events | Existing Community surface. |
| `/schools/[slug]` | Community & Legal | `MOVE-IN-NAV-ONLY` | Community → Schools | Public school profile route, separate from League school management. |
| _No current `/legal`, `/privacy`, `/terms`, `/guidelines` page found_ | Community & Legal | `PROTECTED GAP` | Do not invent routes/content during IA refactor | Add only after separately approved legal copy and route plan. |

### League

| Existing paths | Target area | Classification | Canonical/navigation treatment | Notes |
| --- | --- | --- | --- | --- |
| `/league`, `/league/about`, `/league/dashboard`, `/league/join`, `/league/season`, `/league/standings` | League | `PROTECTED` | League secondary navigation unchanged | Preserve current product hierarchy and season state. |
| `/league/schools`, `/league/schools/profile`, `/league/school-curriculum` | League | `PROTECTED` | League → Schools | Keep school application, curriculum and review authority. |
| `/league/teams` | Teams + League | `PROTECTED` | Teams container links to League team management | Do not merge with `/team`; retains membership/invitation/team administration. |
| `/league/arena`, `/league/arena/[slug]`, `/league/arena/[slug]/workspace` | League | `REUSE` | League challenge entry | Simulation siblings may reuse the engine but retain distinct routes. |
| `/league/behavioural-lab`, `/league/constitution-lab`, `/league/crisis-sprint`, `/league/market-strategy`, `/league/model-battle`, `/league/quick-challenge`, `/league/replay` | League | `PROTECTED` | League activities remain direct routes | `crisis-sprint` is an existing compatibility hand-off to Quick Challenge. |
| `/league/command-centre`, `/league/command-centre/[runId]`, `/league/command-centre/[runId]/results`, `/league/command-centre/run`, `/league/command-centre/run/results` | League | `REUSE` | League Command Centre | Reuse UI where safe; preserve all run URLs and saved state. |
| `/league/competitions`, `/league/competitions/[competitionId]`, `/league/competitions/new`, `/league/competitions/room` | League | `PROTECTED` | League competition system | Competition setup, scoring and roles are authority-sensitive. |
| `/league/scenario-studio`, `/league/scenario-studio/[scenarioId]`, `/league/scenario-studio/archive`, `/league/scenario-studio/editor`, `/league/scenario-studio/new`, `/league/scenario-studio/published` | League | `PROTECTED` | League Scenario Studio | Preserve editor/review/publish pathways. |
| `/league/world`, `/league/world/contracts`, `/league/world/country/[countryId]`, `/league/world/country/[countryId]/[office]`, `/league/world/diplomacy`, `/league/world/leaderboard` | League | `PROTECTED` | League World | Preserve World routes, assignments, policies and contracts. |

### Simulation (protected first-level surface)

| Existing paths | Target area | Classification | Canonical/navigation treatment | Notes |
| --- | --- | --- | --- | --- |
| `/simulation` | Simulation | `PROTECTED` | First-level Simulation landing | Keep as a top-level navigation destination. |
| `/simulation/dashboard`, `/simulation/join`, `/simulation/standings` | Simulation | `REUSE + PROTECTED` | Simulation secondary navigation unchanged | Existing pages reuse League components with Simulation links/labels. |
| `/simulation/arena`, `/simulation/arena/[slug]`, `/simulation/arena/[slug]/workspace` | Simulation | `REUSE + PROTECTED` | Simulation Arena | Keep route-specific `basePath` and labels. |
| `/simulation/behavioural-lab`, `/simulation/constitution-lab`, `/simulation/market-strategy`, `/simulation/model-battle`, `/simulation/quick-challenge`, `/simulation/replay` | Simulation | `PROTECTED` | Existing Simulation destinations | Preserve content and navigation boundary. |
| `/simulation/crisis-sprint` | Simulation | `REDIRECT-ONLY-if-safe + PROTECTED` | Existing redirect to Simulation Quick Challenge | Retain compatibility URL. |
| `/simulation/command-centre`, `/simulation/command-centre/[runId]`, `/simulation/command-centre/[runId]/results`, `/simulation/command-centre/run`, `/simulation/command-centre/run/results` | Simulation | `REUSE + PROTECTED` | Simulation Command Centre | Shared component is acceptable only behind existing wrappers. |
| `/simulation/scenario-studio`, `/simulation/scenario-studio/[scenarioId]`, `/simulation/scenario-studio/archive`, `/simulation/scenario-studio/editor`, `/simulation/scenario-studio/new`, `/simulation/scenario-studio/published` | Simulation | `REUSE + PROTECTED` | Simulation Scenario Studio | Keep all existing deep links. |
| `/simulation/world`, `/simulation/world/contracts`, `/simulation/world/country/[countryId]`, `/simulation/world/country/[countryId]/[office]`, `/simulation/world/diplomacy`, `/simulation/world/leaderboard` | Simulation | `REUSE + PROTECTED` | Simulation World | Preserve current navigation, governance and state mechanics. |
| `/simulation/legacy-world`, `/simulation/legacy-world/admin`, `/simulation/legacy-world/country`, `/simulation/legacy-world/lobby`, `/simulation/legacy-world/new`, `/simulation/legacy-world/replay`, `/simulation/legacy-world/results`, `/simulation/legacy-world/room`, `/simulation/legacy-world/world` | Simulation | `WRAPPER + PROTECTED` | Legacy compatibility surface | Keep until explicit lifecycle decision, with tests before any extraction. |

### Existing legacy and role-gated compatibility routes

| Existing paths | Target area | Classification | Canonical/navigation treatment | Notes |
| --- | --- | --- | --- | --- |
| `/world` | Simulation | `REDIRECT-ONLY-if-safe` | Redirect to `/simulation/world` | Preserve incoming links. |
| `/country`, `/lobby`, `/room`, `/results`, `/replay`, `/view` | Simulation/League compatibility | `WRAPPER` | Keep explicit compatibility contracts | Current components preserve older competition surfaces. |
| `/country` (and related top-level legacy competition paths) | Simulation | `PROTECTED` | No navigation promotion required | Need regression tests before any unification. |
| `/admin`, `/admin/cases`, `/admin/daily-brief`, `/admin/scenario-studio`, `/admin/viewer-invitations` | Workspace | `ADMIN/ROLE-GATED` | Account/admin utilities | Never exposed as normal public nav. |
| `/dev/model-health` | Development | `ADMIN/ROLE-GATED` | No standard navigation | Retain development gate and static-export safety. |
| `/lobby`, `/room`, `/results`, `/replay` | Compatibility | `WRAPPER` | Preserve historical deep links | Do not redirect wholesale without analytics and tests. |

## 5. Existing component map and safe reuse opportunities

| Domain | Current components | Audit result | Later action (only after approval) |
| --- | --- | --- | --- |
| Navigation | `components/ui/page-shell.tsx` (`Navbar`), `lib/platform/feature-flags.ts`, League and Simulation navigation components | Three navigation registries contain overlapping product knowledge. | Introduce one typed navigation configuration that drives desktop, mobile, active state and container menus; preserve existing route handlers. |
| League ↔ Simulation | `components/league/*`, `components/simulation/*` | Multiple Simulation pages already render League-owned components. | Preserve the outer page wrappers, labels and `basePath`; extract only common presentation/controller logic. |
| Competition surfaces | `components/league/competition-pages.tsx`, `components/simulation/legacy-competition-pages.tsx` | Nearly parallel controllers with path/label differences and shared autosave/Realtime semantics. | Extract a neutral controller with a typed route context only after exact user-flow tests pass. |
| World systems | `components/world/continuous-world-dashboard.tsx`, `components/world-governance/world-simulation.tsx`, League world pages | These are related but not interchangeable World experiences. | Treat as distinct systems; do not merge merely because names overlap. |
| Team | `components/team/team-page.tsx`, `components/league/league-teams.tsx` | Public leadership directory and League team management have separate roles/data. | Group under `Teams`; do not consolidate data or delete either page. |
| Learning/Lab | `components/learning/*`, `components/models/*`, `components/sandbox/*`, `components/mechanism-arena/*`, `components/experiments/*` | Clear functional families, with some very large feature components. | Create domain-level entry/section wrappers before splitting components. |
| Community/Agora | `components/agora/*` and related public pages | Independent Community shell and content hierarchy. | Keep internal Community navigation; provide top-level container entry only. |
| Large components | `continuous-world-dashboard.tsx`, `league/command-centre.tsx`, EconBench/Evidence workspaces, `world-governance/world-simulation.tsx`, Scenario Studio, League Dashboard | Size alone is not a bug. | Split only around stable concepts (data loader, controls, visualisation, action panel), never by arbitrary line count. |

## 6. Service, data and authority map

The desired application boundary is:

`UI → hook/controller → domain service → Supabase adapter/RPC → database/RLS`

Current services are already partly organised by product. Later work should move duplicated client orchestration into those existing services, not introduce a second backend stack.

| UI domain | Existing service/adaptor | Main persistent resources or RPC boundary | Authority notes |
| --- | --- | --- | --- |
| Auth, profile, saved learning | `lib/supabase/data.ts`, `account-onboarding.ts`, auth provider | `profiles`, `model_runs`, `favorites`, `learning_progress`, `recent_activity`; module activity RPCs | Profile/RLS remains authority; client role state is display guidance. |
| Cases | `lib/supabase/cases.ts` | `case_runs` | Preserve user-owned records. |
| Daily Brief | `lib/supabase/daily-brief.ts` | `daily_brief_items`, sources, jobs, settings, `economic_cases` | Editorial/admin actions remain role-gated. |
| Sandbox/Command Centre | `lib/supabase/command-centre.ts` | sandbox scenario/run/round records; create/submit/abandon/duplicate RPCs | Browser calculations remain local where currently designed; save actions retain current RPC validation. |
| Model Composer | `lib/supabase/model-composer.ts` | `model_compositions`; save/publish RPCs | Preserve ownership and publishing authority. |
| EconBench | `lib/supabase/econbench.ts` | learning-progress persistence | Preserve grading/progress semantics. |
| Experiments | `lib/supabase/experiments.ts`, `lib/experiments/security.ts` | participant/feedback/share resources and experiment RPCs | One explicit permission module exists; retain final RLS/RPC checks. |
| League directory and teams | `lib/supabase/league.ts`, `league-directory.ts` | schools, teams, team membership, applications, crisis records; membership/school-review RPCs | School Leader/platform roles must preserve exact scope. |
| League challenges | `lib/supabase/league-challenges.ts` | challenge, attempts, decisions and assignment resources | Attempts, ghost strategy and ranking behaviour protected. |
| League infrastructure | `lib/supabase/league-infrastructure.ts` | competition/scenario/country/role/round/draft/submission/agreement/trade/event resources and RPCs | Competition settlement and assignment actions are authority-sensitive. |
| Continuous World | `lib/supabase/continuous-world.ts` | continuous worlds, country teams, actions, contracts, events, calibration packages | Preserve long-running simulation policy and contract logic. |
| World governance | `lib/supabase/world-governance.ts`, `lib/world-governance/*` | Adapter above Continuous World plus simulation derivation | Frontend `mayPublishWorldPolicy` is not final authority. |
| Professor Studio | `lib/supabase/professor-studio.ts` | project listing/save/review RPCs | Professor role remains independent from school roles. |
| View invitations | `lib/supabase/viewer-invitations.ts` | invitation validate/list/create/activate RPCs | Viewer access remains read-only and school-unbound. |

### Authority consolidation findings

- `AuthProvider` reads `profiles.role` and `profiles.platform_role`, and currently decides display-level capabilities such as World supervisor access.
- League, Competition, Scenario Studio and Command Centre components also make local role checks before calling an RPC.
- This is acceptable only because Supabase RLS and RPCs remain the enforcement layer. A later cleanup may expose typed domain access helpers, but must not broaden client-side authority or replace server checks.
- No database schema consolidation is warranted in this migration phase.

## 7. Realtime and refresh audit

### Current subscription topology

`subscribeToLeagueCompetition(competitionId, onChange)` in `lib/supabase/league-infrastructure.ts` creates channel `league-competition-${competitionId}` and listens to `INSERT`, `UPDATE`, and `DELETE` events for:

- `competitions` filtered by competition ID;
- `competition_rounds`;
- `institution_drafts`;
- `country_submissions`;
- `international_agreements`;
- `trade_flows`;
- `competition_events`.

It is mounted by both:

- `components/league/competition-pages.tsx`; and
- `components/simulation/legacy-competition-pages.tsx`.

Both currently answer an event by refreshing the full competition snapshot. That is correct for consistency but can be unnecessarily expensive, because the snapshot fetch aggregates multiple related resources.

### Safe later optimisation path

1. Preserve the exact channel name, filters, subscription lifecycle and user-visible refresh outcome first.
2. Add a shared controller so League and legacy Simulation do not implement divergent subscription lifecycles.
3. Debounce same-tick event bursts and deduplicate in-flight refreshes.
4. Where validated by tests, apply small immutable state patches for isolated events; retain full refresh for state transitions that can affect several resources.
5. Do not introduce polling, a new realtime provider, or a new worker merely for this refactor.

### Timers found

- Competition surfaces have a deliberate ~1.4 second autosave delay.
- World dashboard has an interaction debounce.
- Auth refreshes profile state on focus/visibility.
- Mechanism Arena uses local animation timing.

No repeating polling interval was found in the audited product surfaces. These timers should be documented rather than removed.

## 8. Data-fetch and performance observations

- Several feature pages use local `Promise.all` batches. This is acceptable where resources are independent, but a future domain controller can centralise loading states and errors without changing query semantics.
- Competition snapshot refresh is the clearest candidate for scoped cache/deduplication because it receives broad Realtime events.
- Static export is already supported through the GitHub Pages configuration (`GITHUB_PAGES`, `basePath`, `trailingSlash`, unoptimised images). Any new navigation configuration must use static-safe links and avoid server-only assumptions.
- Images and visual components should preserve static-export compatibility; do not introduce an image pipeline dependent on a server runtime.

## 9. Recommended implementation sequence after approval

1. **Baseline:** run and record existing typecheck/test/build results; add route and navigation regression coverage without behaviour change.
2. **Navigation foundation:** add one typed `NavigationSection` configuration and adapt desktop/mobile navigation to read it. Keep the current URL list and active-state behaviour.
3. **Container menus:** add Discoverable Explore, Learn, Lab, Simulation, League, Teams, Community & Legal, Workspace groupings. Keep Simulation's existing secondary navigation exactly as-is.
4. **Route wrappers:** retain all old entry points; update links to the appropriate group while maintaining direct access.
5. **Component/service reuse:** extract only proven duplicate controllers (starting with competition pages), preserving route context and all permissions.
6. **Realtime/performance:** after feature regression tests, deduplicate snapshot refreshes and improve loading resilience.
7. **QA:** static export, responsive navigation, signed-out/viewer/student/School Leader/Professor/platform-admin checks, Simulation invariant checks, Community and legal-link checks.

## 10. Required regression coverage before merging implementation

- Every existing route above resolves under static export or retains its defined redirect.
- Desktop and mobile navigation render from the same source configuration and expose the requested eight areas in order.
- Active link state does not accidentally select `/team` for `/league/teams` or `/league` for `/simulation`.
- Simulation secondary navigation, World policies, role access, time/round semantics, scores, contracts, Realtime state and saved content are unchanged.
- League school approval, school curriculum, Team membership/invitation and School Leader scope are unchanged.
- Viewer invitation mode remains read-only.
- Professor and platform-admin entry points remain role-gated.
- Community routes and existing public pages resolve without an authentication regression.
- Realtime subscription cleans up on navigation and does not launch duplicate refreshes.
- No client code contains a Supabase service-role key.

### Audit baseline run (2026-08-27)

| Check | Result | Interpretation |
| --- | --- | --- |
| `npm run typecheck` | Passed | The current working tree type-checks. |
| `npm run build` | Passed | Production build and static page generation complete successfully. |
| `npm test` | 270 passed / 1 failed | The sole failure is `registered-app-gate.test.ts`. It expects the root layout to contain the previous `RegisteredAppGate`, `Navbar`, and `Footer` wrapper. The current, uncommitted root layout instead renders the new Community/Agora shell. This predates and is unrelated to this audit document, but must be reconciled before a navigation migration merges. |

The first command used to invoke Vitest included an unsupported Jest-style flag and was rerun using the repository's native `npm test` script. The result above is the authoritative baseline.

## 11. Audit conclusion and approval gate

The codebase is suitable for an incremental IA migration. The safest route is **configuration-first navigation consolidation**, followed by wrapper-preserving component reuse. The audit does **not** recommend a large physical folder move, a route rewrite, a database migration, or any change to continuous/competition simulation rules.

**Approval required before implementation:** apply navigation changes, create any new Community & Legal route/content, extract duplicate controllers, or optimise Realtime refreshes.
