# Daily Brief: free Supabase setup

Daily Brief is deliberately small and review-first. It fetches only RSS or Atom feeds, stores a source-attributed excerpt of at most 360 characters, scores current candidates with deterministic TypeScript rules, and publishes only reviewed items. It uses no AI API, article-page scraping service, image copying, or paid server.

## 1. Apply the schema migration

Apply all pending migrations in timestamp order. The initial `20260728010000_real_world_cases_daily_brief.sql` creates the feature tables; `20260824010000_repair_daily_brief_freshness.sql` adds the short-excerpt provenance, source-date and review-only constraints, restores the minimum quality score, and seeds the attributed WTO feed. With a linked project, use `npx supabase db push --linked`.

- `daily_brief_sources` — feed URLs verified and managed by a teacher;
- `daily_brief_items` — candidates, review state, scores, original URL, topic and case links;
- `daily_brief_settings` — the review-first publication policy and a score threshold;
- `daily_brief_jobs` — minimal collection audit records.

All tables have RLS. The public can only read `published` items. Only the existing `teacher` role can manage sources, settings, or editorial status. Case runs remain owner-only.

To grant your own signed-in account teacher access, open **Authentication → Users**, copy its UUID, and run this once in the SQL editor:

```sql
update public.profiles
set role = 'teacher'
where user_id = 'PASTE_YOUR_AUTH_USER_UUID_HERE';
```

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

The collector accepts either a teacher’s authenticated manual request from `/admin/daily-brief` or the cron secret. It fetches feed XML without an HTTP cache, with a timeout and a 1 MB response limit. It reads at most 20 entries per source and requires a valid source date, title, short RSS/Atom summary, and HTTPS original-article URL. Items older than seven days or more than one day in the future are skipped. Existing database fingerprints are removed **before** the four-item limit is applied, so older duplicates cannot block newer news. The collector never fetches full news article pages and never falls back to `<content>` or `<content:encoded>` bodies.

### CLI commands

From the `econmind-os` folder, run the following. Replace `YOUR_LONG_RANDOM_SECRET` with a newly generated long random value, and keep it private.

```bash
npx supabase login
npx supabase link --project-ref vimksjrhaxdpnkvgsavz
npx supabase functions deploy collect-daily-economic-brief
npx supabase secrets set DAILY_BRIEF_CRON_SECRET=YOUR_LONG_RANDOM_SECRET
```

Use the **same** `YOUR_LONG_RANDOM_SECRET` for the Vault step below. The function has access to the Supabase service-role key only inside its protected server runtime; it is not copied into the website.

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

The migration seeds the official public `WTO News` feed as an attribution-labelled source. This name identifies the publisher; it does not imply an EconMind partnership, endorsement, or affiliation. The [WTO RSS guidance](https://www.wto.org/english/res_e/webcas_e/rss_e.htm) encourages syndication with attribution as “WTO news” and prohibits use of the WTO logo or presenting it as another source. A teacher can disable it or add other verified public RSS/Atom feeds.

1. Add or enable a verified public RSS or Atom feed URL.
2. Keep **Review mode** selected.
3. Choose **Collect now** to test the feed.
4. Publish or reject each candidate after reading the original source.

Examples of suitable source families are agencies or international organisations with public feeds, such as IEA, World Bank, IMF, OECD, WTO, UN agencies, or national statistical offices. Verify each particular feed URL on the publisher’s own site before adding it. The publisher name is attribution only: do not enter names such as `EconMind × WTO`, `official partner`, or other wording that suggests a relationship.

Before publishing a candidate, use the administration card’s original-source link to check the headline, source date, excerpt, and context. Public cards display the source date rather than the internal review date and link directly to the original article. Current excerpts are source-feed text, not an EconMind or AI-generated translation.

## 5. Verify freshness and scheduling

The administration page records source failures, fresh candidates, duplicates skipped, and inserts for each run. For a database-level health check:

```sql
select jobname, schedule, active
from cron.job
where jobname = 'econmind-daily-brief-singapore-0700';

select started_at, status, sources_checked, candidates_found, items_inserted,
       error_message, metadata
from public.daily_brief_jobs
order by started_at desc
limit 10;

select source_name, title, published_source_at, fetched_at, status, canonical_url
from public.daily_brief_items
order by fetched_at desc
limit 20;
```

## Deployment note

The Cases library, Daily Brief list/archive, and individual live briefs work with the existing GitHub Pages static build. Live brief links use the exported `/daily-brief/read?brief=<slug>` route and load the reviewed record from Supabase in the browser; no server-rendered dynamic route is required.
