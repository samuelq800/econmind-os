# Daily Brief: free Supabase setup

Daily Brief is deliberately small and review-first. It fetches only RSS or Atom feeds that a teacher configures, stores brief metadata and a short feed summary, scores candidates with deterministic TypeScript rules, and publishes only reviewed items by default. It uses no AI API, scraping service, or paid server.

## 1. Apply the schema migration

Run `supabase/migrations/20260728010000_real_world_cases_daily_brief.sql` in the Supabase SQL editor after the existing migrations. It creates:

- `daily_brief_sources` — teacher-managed official feed URLs;
- `daily_brief_items` — candidates, review state, scores, original URL, topic and case links;
- `daily_brief_settings` — `review` or `automatic` publication and a score threshold;
- `daily_brief_jobs` — minimal collection audit records.

All tables have RLS. The public can only read `published` items. Only the existing `teacher` role can manage sources, settings, or editorial status. Case runs remain owner-only.

## 2. Deploy the Edge Function

Deploy `supabase/functions/collect-daily-economic-brief/index.ts` from the Supabase CLI or Dashboard. Set the following server-side function secret:

```text
DAILY_BRIEF_CRON_SECRET=<long random value>
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are used only inside the protected Edge Function runtime. Do not add a service-role key to a `.env` file exposed to Next.js, GitHub Pages, or the browser. The public application needs only:

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

The collector accepts either a teacher’s authenticated manual request from `/admin/daily-brief` or the cron secret. It fetches the feed XML with a timeout, reads at most 20 entries per source, deduplicates by stable fingerprint, and never fetches full news article pages.

## 3. Create Vault secrets and schedule 07:00 Singapore

In the SQL editor, create two Vault secrets before applying `20260728011000_daily_brief_cron.sql`:

```sql
select vault.create_secret('https://YOUR_PROJECT_REF.supabase.co', 'project_url');
select vault.create_secret('THE_SAME_LONG_RANDOM_VALUE', 'daily_brief_cron_secret');
```

Then run the cron migration. It enables `pg_cron` and `pg_net` and schedules `0 23 * * *`, which is 07:00 in Singapore (UTC+8) on the following calendar day. Singapore does not observe daylight saving time.

To pause it without deleting sources:

```sql
select cron.unschedule(jobid)
from cron.job
where jobname = 'econmind-daily-brief-singapore-0700';
```

## 4. Add sources and review

Sign in with a profile whose `role` is `teacher`, then open `/admin/daily-brief`.

1. Add an official public RSS or Atom feed URL.
2. Keep **Review mode** selected.
3. Choose **Collect now** to test the feed.
4. Publish or reject each candidate after reading the original source.

Examples of suitable source families are official agencies or international organisations with public feeds, such as IEA, World Bank, IMF, OECD, WTO, UN agencies, or national statistical offices. Verify each particular feed URL in the source’s own site before adding it.

## Deployment note

The Cases library and main Daily Brief/archive pages work with the existing GitHub Pages static build. A newly generated individual Daily Brief permalink requires a server-capable deployment such as Vercel because a static export cannot pre-create an unknown future dynamic path. The free Vercel Hobby plan can host the Next frontend; Supabase remains the single backend.
