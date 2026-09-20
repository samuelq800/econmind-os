import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync("supabase/migrations/20260920000200_admin_mail_terminal.sql", "utf8");

// Source contract checks only. They deliberately do not execute a migration or
// claim to replace PostgreSQL/RLS integration tests in a disposable database.
describe("mail migration security contracts", () => {
  it("adds only mail objects without changing existing roles or history", () => {
    expect(sql).not.toMatch(/\b(drop|truncate)\s+(table|schema)/i);
    expect(sql).not.toMatch(/\b(update|delete\s+from|insert\s+into|alter\s+table)\s+(public\.)?(profiles|auth\.users)\b/i);
    expect(sql).toMatch(/begin;/);
    expect(sql).toMatch(/commit;/);
  });

  it("restricts reads through the canonical admin helper and exposes no browser writes", () => {
    for (const table of ["mail_threads", "mail_messages", "mail_delivery_events"]) {
      expect(sql).toContain(`alter table public.${table} enable row level security`);
    }
    expect(sql).toContain("revoke all on public.mail_threads, public.mail_messages, public.mail_delivery_events from public, anon, authenticated");
    expect(sql).toContain("grant select on public.mail_threads, public.mail_messages to authenticated");
    expect(sql.match(/using \(public\.is_platform_admin\(\(select auth\.uid\(\)\)\)\)/g)).toHaveLength(2);
    expect(sql).not.toMatch(/create policy[^;]+for (insert|update|delete|all)/i);
    expect(sql).not.toMatch(/grant (all|insert|update|delete|execute)[^;]+to authenticated/i);
    expect(sql).not.toMatch(/security definer/i);
  });

  it("persists durable request and inbound uniqueness and protects audit snapshots", () => {
    expect(sql).toContain("request_id uuid unique");
    expect(sql).toContain("inbound_dedupe_key text unique");
    expect(sql).toContain("create unique index mail_messages_inbound_id_idx");
    expect(sql).toContain("Request ID payload mismatch");
    expect(sql).toContain("Mail snapshots are immutable");
    expect(sql).toContain("Mail history cannot be deleted");
    expect(sql).not.toContain("on delete cascade");
  });

  it("matches reply headers in order, never subject, and keeps raw identity as a fallback", () => {
    const ingest = sql.slice(sql.indexOf("create function public.mail_ingest_inbound"), sql.indexOf("create function public.mail_apply_delivery_event"));
    expect(ingest.indexOf("internet_message_id = v_parent")).toBeLessThan(ingest.indexOf("unnest(v_refs)"));
    expect(ingest).toContain("order by ref.ord desc");
    expect(ingest).toContain("'mid:' || v_identity else 'raw:'");
    expect(ingest).not.toMatch(/where\s+(message\.)?subject/i);
    expect(ingest.indexOf("'duplicate', true")).toBeLessThan(ingest.indexOf("insert into public.mail_threads"));
  });

  it("serializes provider binding and events and never lowers delivered to accepted", () => {
    expect(sql.match(/pg_advisory_xact_lock\(hashtextextended\('mail-provider:'/g)).toHaveLength(2);
    expect(sql).toContain("on conflict (event_key) do nothing");
    expect(sql).toContain("public.mail_delivery_rank(v_event.status) > public.mail_delivery_rank(v_message.delivery_status)");
    expect(sql).toContain("when 'delivered' then 50");
    expect(sql).toContain("when 'accepted' then 10");
  });
});
