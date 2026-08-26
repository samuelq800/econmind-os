# EconMind OS
Interactive economics learning and simulation platform.

The product map below — visitor → auth → app journey, the teaching systems,
the live service paths, and the deployment host.

## Run
```bash
pnpm install --frozen-lockfile
cp .env.example .env.local
pnpm dev
```
Supabase variables are required for accounts and cloud saves; the simulations still work locally without them. Quality checks: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`.

## Architecture
- Next.js App Router, strict TypeScript, Tailwind CSS, Recharts
- Pure calculations in `lib/economics/`
- localStorage for parameters and Scenario A/B
- Supabase email Auth, persisted sessions, private cloud runs, favorites, and learning progress
- Economist Workspace dashboard with compact activity aggregation
- Economic Sandbox with deterministic policy-mix simulation and local run timeline
- Interactive Price Controls model
- Unified model registry for navigation, recommendations, and progress
- Supabase browser client using only public environment variables
- Full PostgreSQL migration, indexes, triggers, and RLS in `supabase/migrations/`

No service-role key is used or expected in the frontend.

## GitHub Pages

The repository includes a GitHub Actions workflow that verifies and exports the
site on every push to `main`. It deploys to:

`https://econmind.group/`

The custom domain serves the Pages artifact from `/`, so the deployment sets an
empty `NEXT_PUBLIC_BASE_PATH`. The configuration can still use `/econmind-os`
for a project-site build without a custom domain.

Database migrations must be applied before pushing a frontend commit that
depends on them. The Pages workflow probes the required public directory RPC
and fails closed before deployment when the linked Supabase schema is behind;
the previously deployed site remains available.

## Testing

Run the workspace checks with:

```powershell
npx vitest run
```

Focused suites for the latest dashboard work:

- `tests/continuous-world-dashboard.test.ts` — desktop scrollability gate for the world dashboard history timeline.
- `tests/world-entrypoint.test.ts` — twelve-country overview and six-office country cabinet entrypoints.

Current module docs:

- `docs/continuous-world-dashboard.md` — dashboard structure, sign-in gate behavior, desktop scrollability contract, and routing notes.
