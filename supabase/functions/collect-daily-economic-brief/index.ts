import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { parseFeed } from "../../../lib/daily-brief/feed.ts";
import { DAILY_BRIEF_MAX_ITEMS_PER_DAY, isFreshCandidate, remainingDailyBriefSlots, scoreCandidate, selectBriefsForReview, slugForBrief } from "../../../lib/daily-brief/rules.ts";
import type { FeedCandidate } from "../../../lib/daily-brief/types.ts";

type SourceRow = { id: string; name: string; feed_url: string; source_type: "rss" | "atom"; priority: number; enabled: boolean };
type SourceFetchResult = { source: SourceRow; candidates: FeedCandidate[]; error: string | null };
type AdminClient = SupabaseClient;
const MAXIMUM_FEED_BYTES = 1_000_000;
const singaporeDayRange = () => {
  const localDate = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const [year, month, day] = localDate.split("-").map(Number);
  const start = new Date(Date.UTC(year, month - 1, day - 1, 16)).toISOString();
  const end = new Date(Date.UTC(year, month - 1, day, 16)).toISOString();
  return { start, end };
};
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Cache-Control": "no-store", "Content-Type": "application/json" };

async function fetchSource(source: SourceRow): Promise<SourceFetchResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9000);
  try {
    const response = await fetch(source.feed_url, {
      cache: "no-store",
      headers: { "Cache-Control": "no-cache", "User-Agent": "EconMindOS-DailyBrief/1.1 (+educational)" },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const declaredLength = Number(response.headers.get("content-length") ?? 0);
    if (declaredLength > MAXIMUM_FEED_BYTES) throw new Error("feed is larger than 1 MB");
    const xml = await response.text();
    if (new TextEncoder().encode(xml).byteLength > MAXIMUM_FEED_BYTES) throw new Error("feed is larger than 1 MB");
    const candidates = parseFeed(xml, source);
    if (!candidates.length) throw new Error("no dated entries with a title, short summary, and HTTPS article link");
    return { source, candidates, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown feed error";
    return { source, candidates: [], error: message.slice(0, 300) };
  } finally {
    clearTimeout(timeout);
  }
}

async function findExistingFingerprints(admin: AdminClient, fingerprints: string[]) {
  const existing = new Set<string>();
  for (let offset = 0; offset < fingerprints.length; offset += 100) {
    const batch = fingerprints.slice(offset, offset + 100);
    const { data, error } = await admin.from("daily_brief_items").select("fingerprint").in("fingerprint", batch);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) existing.add(String(row.fingerprint));
  }
  return existing;
}

async function allowed(request: Request, admin: AdminClient) {
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
      admin.from("daily_brief_settings").select("minimum_score").eq("id", true).maybeSingle(),
    ]);
    if (sourcesError) throw new Error(sourcesError.message);
    const rows = (sources ?? []) as SourceRow[];
    if (!rows.length) throw new Error("No enabled RSS/Atom source is configured.");
    const day = singaporeDayRange();
    const { count: collectedToday, error: collectedTodayError } = await admin.from("daily_brief_items").select("id", { count: "exact", head: true }).gte("created_at", day.start).lt("created_at", day.end);
    if (collectedTodayError) throw new Error(collectedTodayError.message);
    const fetched = await Promise.all(rows.map(fetchSource));
    const sourceFailures = fetched.filter((result) => result.error).map((result) => ({ source: result.source.name, error: result.error }));
    if (sourceFailures.length === rows.length) throw new Error(`All configured feeds failed: ${sourceFailures.map((failure) => `${failure.source} (${failure.error})`).join("; ")}`);

    const seen = new Set<string>();
    const candidates = fetched.flatMap((result) => result.candidates).map(scoreCandidate).filter((item) => item.title.length > 8 && item.summary.length > 30).filter((item) => { if (seen.has(item.fingerprint)) return false; seen.add(item.fingerprint); return true; });
    const threshold = Number(settings?.minimum_score ?? 55);
    const now = new Date();
    const freshCandidates = candidates.filter((item) => isFreshCandidate(item, now));
    const existingFingerprints = await findExistingFingerprints(admin, freshCandidates.map((item) => item.fingerprint));
    const unseenCandidates = freshCandidates.filter((item) => !existingFingerprints.has(item.fingerprint));
    const remainingSlots = remainingDailyBriefSlots(collectedToday ?? 0);
    const rowsToInsert = selectBriefsForReview(unseenCandidates, threshold, remainingSlots, now).map((item) => ({
      slug: slugForBrief(item), source_id: item.sourceId, source_name: item.sourceName, source_url: item.sourceUrl, canonical_url: item.canonicalUrl, title: item.title, summary: item.summary,
      summary_kind: "source_feed_excerpt", published_source_at: item.publishedSourceAt, topic_tags: item.tags, case_slugs: item.caseSlugs, teaching_score: item.score, score_breakdown: item.breakdown, fingerprint: item.fingerprint,
      status: "candidate", published_at: null,
    }));
    let inserted = 0;
    if (rowsToInsert.length) { const { data, error } = await admin.from("daily_brief_items").upsert(rowsToInsert, { onConflict: "fingerprint", ignoreDuplicates: true }).select("id"); if (error) throw new Error(error.message); inserted = data?.length ?? 0; }
    const metadata = { threshold, publicationMode: "review", maximumItemsPerDay: DAILY_BRIEF_MAX_ITEMS_PER_DAY, collectedToday: collectedToday ?? 0, freshCandidates: freshCandidates.length, staleSkipped: candidates.length - freshCandidates.length, duplicatesSkipped: existingFingerprints.size, sourceFailures };
    await admin.from("daily_brief_jobs").update({ status: "completed", finished_at: new Date().toISOString(), sources_checked: rows.length, candidates_found: candidates.length, items_inserted: inserted, metadata }).eq("id", job.id);
    return new Response(JSON.stringify({ ok: true, sourcesChecked: rows.length, candidatesFound: candidates.length, freshCandidates: freshCandidates.length, staleSkipped: candidates.length - freshCandidates.length, duplicatesSkipped: existingFingerprints.size, remainingSlots, itemsInserted: inserted, sourceFailures }), { headers: cors });
  } catch (error) {
    const message = (error instanceof Error ? error.message : "Unknown collection error").slice(0, 4900);
    await admin.from("daily_brief_jobs").update({ status: "failed", finished_at: new Date().toISOString(), error_message: message }).eq("id", job.id);
    return new Response(JSON.stringify({ ok: false, message }), { status: 500, headers: cors });
  }
});
