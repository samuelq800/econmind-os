# Phases 3–6: Architecture, Efficiency and Regression Record

## Scope and invariants

This pass consolidates application-layer frontend and Supabase access code. It does not alter database schema, RLS, roles, score calculations, World Simulation rules, Realtime subscriptions, or public route URLs.

The protected Simulation route family remains untouched. In particular, the separate `components/league/competition-pages.tsx` and `components/simulation/legacy-competition-pages.tsx` are retained because they support different compatibility routes; they are not a safe deduplication target.

## Shared service boundary

`lib/supabase/client.ts` is the single place that now owns:

- the browser Supabase singleton;
- configuration detection;
- the existing fail-fast behaviour for data-backed features; and
- uniform conversion of Supabase operation errors into application errors.

The account onboarding, Cases, Command Centre, Continuous World, Daily Brief, dashboard data, EconBench, Experiments, League, League Challenges, League Directory, League Infrastructure, Model Composer, Professor Studio and viewer invitation services all consume this boundary. Their query, RPC and authorization semantics are otherwise unchanged.

The League Infrastructure Realtime subscription deliberately continues to use the nullable browser-client accessor. A missing frontend configuration therefore still produces no subscription rather than a new runtime exception.

## Request reduction

The Teams workspace previously issued one attempt-history request per Team merely to display submitted-attempt totals. It now makes one RLS-scoped, filtered query for the displayed Team IDs. The visible count and permissions are unchanged, while a school with _n_ Teams now performs one request instead of _n_ requests.

Existing dashboard loading already uses parallel reads, so it was preserved rather than replaced with a speculative abstraction.

## Build hygiene and route compatibility

`preview-site/` is a generated static preview rather than application source. It is excluded from ESLint alongside `.next/` and `node_modules/`; this allows the repository lint to evaluate the actual application code without mutating or deleting the preview artifact.

The canonical navigation configuration remains the source for desktop navigation, mobile navigation and footer links. Simulation remains a direct top-level entry, so its internal navigation and content hierarchy are not duplicated into global menus.

## Validation gates

The final phase runs type checking, linting, unit tests, the calibration validation and a production build. No deployment, commit or database migration is part of this phase.
