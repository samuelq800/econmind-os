-- Runs the collector at 07:00 Asia/Singapore (23:00 UTC on the previous day).
-- Before applying this migration, create these Vault secrets in the Supabase SQL
-- editor (values never belong in Next.js, Git, or client code):
--   select vault.create_secret('https://YOUR_PROJECT_REF.supabase.co', 'project_url');
--   select vault.create_secret('A_LONG_RANDOM_VALUE', 'daily_brief_cron_secret');
-- Set the same DAILY_BRIEF_CRON_SECRET in the Edge Function's server-side secrets.

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule(jobid)
from cron.job
where jobname = 'econmind-daily-brief-singapore-0700';

select cron.schedule(
  'econmind-daily-brief-singapore-0700',
  '0 23 * * *',
  $$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url' limit 1) || '/functions/v1/collect-daily-economic-brief',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'daily_brief_cron_secret' limit 1)
      ),
      body := '{"trigger":"cron"}'::jsonb
    );
  $$
);
