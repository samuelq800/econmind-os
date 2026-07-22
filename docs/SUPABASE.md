# Supabase backend guide

## Create and connect
1. Create a free project named `EconMind OS` in the Singapore region.
2. Open SQL Editor, paste `supabase/migrations/20260722000000_initial_schema.sql`, and run it once.
3. Copy Project URL and the public anon/publishable key from Project Settings → API.
4. Put them in `.env.local` as `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
5. In the GitHub repository, open Settings → Secrets and variables → Actions and create repository secrets with those same two names. The Pages workflow injects them only while building the public frontend.
6. Run the **Deploy EconMind OS to GitHub Pages** workflow again, or push a new commit to `main`.

If the frontend later moves to Vercel, add the same two public variables under Project Settings → Environment Variables and redeploy. For email confirmation in the Auth version, set the Supabase Site URL to `https://samuelq800.github.io/econmind-os/` and add that URL to the allowed redirect list.

Never add `SUPABASE_SERVICE_ROLE_KEY` to this frontend.

## Tables
- `profiles`: one profile per Auth user; created automatically by an Auth trigger.
- `model_runs`: named scenarios and experiments. Both `parameters` and `results` are `jsonb`, so new models need no table redesign.
- `favorites`: one favorite row per user/model.
- `learning_progress`: model status, percentage, latest parameters, and visit timestamps.

All four tables use RLS. Every select/insert/update/delete policy requires `auth.uid() = user_id`.

## Next-version Auth
Use `getSupabaseBrowserClient()` from `lib/supabase/client.ts`, then add email `signUp`, `signInWithPassword`, and `signOut` screens. Supabase JS persists and refreshes sessions. After sign-in, upsert user-owned rows directly; RLS remains the security boundary.

## Adding a model
Use a stable lowercase `model_key` such as `price-controls`. Save its parameter and result objects in the existing `jsonb` columns. No migration is required unless the model introduces shared relational data.
