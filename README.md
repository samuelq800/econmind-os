# EconMind OS
Interactive economics learning and simulation platform.

## Run
```bash
pnpm install --frozen-lockfile
cp .env.example .env.local
pnpm dev
```
Supabase variables are optional in this local-first release. Quality checks: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`.

## Architecture
- Next.js App Router, strict TypeScript, Tailwind CSS, Recharts
- Pure calculations in `lib/economics/`
- localStorage for parameters and Scenario A/B
- Optional Supabase browser client using only public environment variables
- Full PostgreSQL migration, indexes, triggers, and RLS in `supabase/migrations/`

No service-role key is used or expected in the frontend.

## GitHub Pages

The repository includes a GitHub Actions workflow that verifies and exports the
site on every push to `main`. It deploys to:

`https://samuelq800.github.io/econmind-os/`

The `GITHUB_PAGES=true` build flag adds the `/econmind-os` base path only during
the Pages build, so ordinary local development continues to use `/`.
