import { createClient } from "npm:@supabase/supabase-js@2";
import { scoreCandidate, slugForBrief } from "../../../lib/daily-brief/rules.ts";
import type { FeedCandidate } from "../../../lib/daily-brief/types.ts";

type SourceRow = { id: string; name: string; feed_url: string; source_type: "rss" | "atom"; priority: number; enabled: boolean };
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Content-Type": "application/json" };
const plain = (value = "") => value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim();
const match = (block: string, tag: string) => new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i").exec(block)?.[1] ?? "";
const absoluteUrl = (value: string, origin: string) => { try { return new URL(value, origin).toString(); } catch { return ""; } };

/** Small dependency-free RSS/Atom parser. It reads feed metadata only and never scrapes full news pages. */
function parseFeed(xml: string, source: SourceRow): FeedCandidate[] {
  const blocks = xml.match(/<(?:item|entry)\b[\s\S]*?<\/(?:item|entry)>/gi) ?? [];
  return blocks.slice(0, 20).flatMap((block) => {
    const title = plain(match(block, "title"));
    const rssLink = plain(match(block, "link"));
    const atomLink = /<link[^>]+href=["']([^"']+)["'][^>]*>/i.exec(block)?.[1] ?? "";
    const canonicalUrl = absoluteUrl(rssLink || atomLink, source.feed_url);
    const summary = plain(match(block, "description") || match(block, "summary") || match(block, "content"));
    const date = plain(match(block, "pubDate") || match(block, "published") || match(block, "updated"));
    if (!title || !canonicalUrl || !summary) return [];
    const parsedDate = Date.parse(date);
    return [{ sourceId: source.id, sourceName: source.name, sourceUrl: source.feed_url, canonicalUrl, title, summary, publishedSourceAt: Number.isFinite(parsedDate) ? new Date(parsedDate).toISOString() : null }];
  });
}

async function allowed(request: Request, admin: ReturnType<typeof createClient>) {
  const auth = request.headers.get("authorization") ?? "";
  const cronSecret = Deno.env.get("DAILY_BRIEF_CRON_SECRET");
  if (cronSecret && auth === `Bearer ${cronSecret}`) return { permitted: true, userId: null };
  const token = auth.replace(/^Bearer\s+/i, "");
  if (!token) return { permitted: false, userId: null };
  const { data: { user } } = await admin.auth.getUser(token);
  if (!user) return { permitted: false, userId: null };
  const { data: profile } = await admin.from("profiles").select("role").eq("user_id", user.id).maybeSingle();
  return { permitted: profile?.role === "teacher", userId: user.id };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return new Response(JSON.stringify({ ok: false, message: "POST only" }), { status: 405, headers: cors });
  const url = Deno.env.get("SUPABASE_URL"); const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceRole) return new Response(JSON.stringify({ ok: false, message: "Missing protected Supabase Edge Function configuration." }), { status: 500, headers: cors });
  const admin = createClient(url, serviceRole, { auth: { persistSession: false } });
  const permission = await allowed(request, admin);
  if (!permission.permitted) return new Response(JSON.stringify({ ok: false, message: "Teacher authorization or cron secret required." }), { status: 401, headers: cors });
  const payload = await request.json().catch(() => ({})) as { trigger?: "cron" | "manual" };
  const trigger = payload.trigger === "cron" ? "cron" : "manual";
  const { data: job, error: jobError } = await admin.from("daily_brief_jobs").insert({ trigger_type: trigger, status: "running", run_by: permission.userId }).select("id").single();
  if (jobError || !job) return new Response(JSON.stringify({ ok: false, message: jobError?.message ?? "Could not create job." }), { status: 500, headers: cors });
  try {
    const [{ data: sources, error: sourcesError }, { data: settings }] = await Promise.all([
      admin.from("daily_brief_sources").select("id,name,feed_url,source_type,priority,enabled").eq("enabled", true).order("priority", { ascending: false }).limit(12),
      admin.from("daily_brief_settings").select("publication_mode,minimum_score").eq("id", true).maybeSingle(),
    ]);
    if (sourcesError) throw new Error(sourcesError.message);
    const rows = (sources ?? []) as SourceRow[];
    const fetched = await Promise.all(rows.map(async (source) => {
      const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 9000);
      try {
        const response = await fetch(source.feed_url, { headers: { "User-Agent": "EconMindOS-DailyBrief/1.0 (+educational)" }, signal: controller.signal });
        if (!response.ok) return [] as FeedCandidate[];
        return parseFeed(await response.text(), source);
      } catch { return [] as FeedCandidate[]; } finally { clearTimeout(timeout); }
    }));
    const seen = new Set<string>();
    const candidates = fetched.flat().map(scoreCandidate).filter((item) => item.title.length > 8 && item.summary.length > 30).filter((item) => { if (seen.has(item.fingerprint)) return false; seen.add(item.fingerprint); return true; });
    const threshold = Number(settings?.minimum_score ?? 55);
    const rowsToInsert = candidates.filter((item) => item.score >= threshold).slice(0, 20).map((item) => ({
      slug: slugForBrief(item), source_id: item.sourceId, source_name: item.sourceName, source_url: item.sourceUrl, canonical_url: item.canonicalUrl, title: item.title, summary: item.summary,
      published_source_at: item.publishedSourceAt, topic_tags: item.tags, case_slugs: item.caseSlugs, teaching_score: item.score, score_breakdown: item.breakdown, fingerprint: item.fingerprint,
      status: settings?.publication_mode === "automatic" ? "published" : "candidate", published_at: settings?.publication_mode === "automatic" ? new Date().toISOString() : null,
    }));
    let inserted = 0;
    if (rowsToInsert.length) { const { data, error } = await admin.from("daily_brief_items").upsert(rowsToInsert, { onConflict: "fingerprint", ignoreDuplicates: true }).select("id"); if (error) throw new Error(error.message); inserted = data?.length ?? 0; }
    await admin.from("daily_brief_jobs").update({ status: "completed", finished_at: new Date().toISOString(), sources_checked: rows.length, candidates_found: candidates.length, items_inserted: inserted, metadata: { threshold, publicationMode: settings?.publication_mode ?? "review" } }).eq("id", job.id);
    return new Response(JSON.stringify({ ok: true, sourcesChecked: rows.length, candidatesFound: candidates.length, itemsInserted: inserted }), { headers: cors });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown collection error";
    await admin.from("daily_brief_jobs").update({ status: "failed", finished_at: new Date().toISOString(), error_message: message }).eq("id", job.id);
    return new Response(JSON.stringify({ ok: false, message }), { status: 500, headers: cors });
  }
});
