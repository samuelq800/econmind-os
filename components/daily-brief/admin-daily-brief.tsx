"use client";

import { useEffect, useState } from "react";
import { Check, ExternalLink, Play, Plus, X } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { DailyBriefItem, DailyBriefJob, DailyBriefSettings, DailyBriefSource } from "@/lib/daily-brief/types";
import { addBriefSource, getBriefSettings, listBriefItemsForReview, listBriefJobs, listBriefSources, reviewBriefItem, setBriefSourceEnabled, triggerBriefCollection, updateBriefSettings } from "@/lib/supabase/daily-brief";

const pending = (item: DailyBriefItem) => item.status === "candidate" || item.status === "selected";
const SUMMARY_DISPLAY_LIMIT = 360;

function shortSourceSummary(summary: string) {
  const value = summary.trim();
  return value.length > SUMMARY_DISPLAY_LIMIT ? `${value.slice(0, SUMMARY_DISPLAY_LIMIT - 1).trimEnd()}…` : value;
}

function sourceDate(value: string | null) {
  if (!value) return "Source date unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Source date unavailable";
  return `Source date ${new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(date)} UTC`;
}

function jobMetric(job: DailyBriefJob, key: string) {
  const value = job.metadata?.[key];
  return typeof value === "number" ? value : null;
}

export function AdminDailyBrief() {
  const { user, role, roleLoading, openAuth } = useAuth();
  const [items, setItems] = useState<DailyBriefItem[]>([]);
  const [sources, setSources] = useState<DailyBriefSource[]>([]);
  const [jobs, setJobs] = useState<DailyBriefJob[]>([]);
  const [settings, setSettings] = useState<DailyBriefSettings | null>(null);
  const [message, setMessage] = useState("");
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [sourceType, setSourceType] = useState<DailyBriefSource["source_type"]>("rss");
  const [priority, setPriority] = useState(50);
  const [openedOriginals, setOpenedOriginals] = useState<Set<string>>(() => new Set());
  const [collecting, setCollecting] = useState(false);

  const load = () => {
    void Promise.all([listBriefItemsForReview(), listBriefSources(), listBriefJobs(), getBriefSettings()])
      .then(([nextItems, nextSources, nextJobs, nextSettings]) => {
        setItems(nextItems);
        setSources(nextSources);
        setJobs(nextJobs);
        setSettings(nextSettings);
      })
      .catch((caught) => setMessage(caught instanceof Error ? caught.message : "Could not load Daily Brief administration."));
  };

  useEffect(() => { if (user && role === "teacher") load(); }, [user, role]);

  if (!user && !roleLoading) return <Gate title="Sign in as a teacher" action={() => openAuth("sign-in")} />;
  if (roleLoading) return <main className="mx-auto min-h-[60vh] max-w-5xl px-5 py-12"><p className="text-sm text-[var(--ink-muted)]">Checking access…</p></main>;
  if (role !== "teacher") return <Gate title="Teacher access required" text="You are signed in, but your account is not a teacher account. The database will also enforce this restriction." />;

  const collect = async () => {
    if (collecting) return;
    setCollecting(true);
    setMessage("Collecting configured public feeds…");
    try {
      const response = await triggerBriefCollection();
      if (!response.ok) {
        setMessage(response.message ?? "Collection did not finish.");
      } else if ((response.itemsInserted ?? 0) > 0) {
        setMessage(`Collection complete. ${response.itemsInserted} current review candidate${response.itemsInserted === 1 ? "" : "s"} added; ${response.duplicatesSkipped ?? 0} known duplicate${response.duplicatesSkipped === 1 ? "" : "s"} skipped.`);
      } else if ((response.freshCandidates ?? 0) === 0) {
        setMessage(`Feeds responded normally, but no eligible item was published by its source in the last seven days. ${response.staleSkipped ?? 0} older item${response.staleSkipped === 1 ? "" : "s"} skipped.`);
      } else {
        setMessage(`Feeds responded normally. No new candidate was added because ${response.duplicatesSkipped ?? 0} current item${response.duplicatesSkipped === 1 ? " was" : "s were"} already known or today’s four-item limit was reached.`);
      }
      load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not start collection.");
    } finally {
      setCollecting(false);
    }
  };

  const saveMinimumScore = () => {
    if (!settings) return;
    void updateBriefSettings({ publication_mode: "review", minimum_score: settings.minimum_score })
      .catch((caught) => setMessage(caught instanceof Error ? caught.message : "Could not save settings."));
  };

  const candidates = items.filter(pending);

  return <main className="mx-auto min-h-screen max-w-6xl px-5 py-12 sm:px-8">
    <header className="flex flex-wrap items-end justify-between gap-5">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[.18em] text-[var(--accent)]">Teacher administration</p>
        <h1 className="mt-2 text-4xl font-bold">Daily Brief review</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--ink-muted)]">The collector reads only configured public RSS/Atom feeds. It saves at most four high-scoring candidates per Singapore day, and every candidate requires teacher review of the original source before publication.</p>
        <p className="mt-2 max-w-3xl text-xs leading-5 text-[var(--ink-faint)]">Candidate text is a shortened source-provided RSS/Atom summary, not an AI-generated summary. Source attribution does not imply endorsement, affiliation, or partnership with EconMind OS.</p>
      </div>
      <Button disabled={collecting} onClick={() => void collect()}><Play size={15} /> {collecting ? "Collecting…" : "Collect now"}</Button>
    </header>

    {message && <p className="mt-5 rounded-lg bg-[var(--accent-soft)] p-4 text-sm text-[var(--accent)]">{message}</p>}

    <section className="mt-8 grid gap-5 lg:grid-cols-[1fr_1fr]">
      <Card className="p-5">
        <h2 className="text-lg font-bold">Publication controls</h2>
        {settings ? <div className="mt-4 space-y-4">
          <div className="rounded-lg bg-[var(--surface-subtle)] p-3">
            <p className="text-xs font-bold">Publication mode</p>
            <p className="mt-1 text-sm text-[var(--ink-muted)]">Teacher review required</p>
          </div>
          <label className="block text-xs font-bold">Minimum teaching score <output className="ml-2 text-[var(--accent)]">{settings.minimum_score}</output>
            <input className="mt-3 w-full" type="range" min="55" max="100" step="5" value={settings.minimum_score} onChange={(event) => setSettings({ ...settings, minimum_score: Number(event.target.value), publication_mode: "review" })} onMouseUp={saveMinimumScore} />
          </label>
          <p className="text-xs leading-5 text-[var(--ink-muted)]">Daily 07:00 Singapore scheduling is configured in Supabase. The quality threshold cannot be set below 55, and no more than four eligible items can be collected in one Singapore day, including manual collection.</p>
        </div> : <p className="mt-3 text-sm text-[var(--ink-muted)]">No settings row found. Run the migration first.</p>}
      </Card>

      <Card className="p-5">
        <h2 className="text-lg font-bold">Add verified RSS/Atom source</h2>
        <div className="mt-4 grid gap-3">
          <input value={name} onChange={(event) => setName(event.target.value)} className="h-10 rounded-lg border border-[var(--line)] bg-[var(--canvas)] px-3 text-sm" placeholder="Attribution label (e.g. WTO News)" />
          <input value={url} onChange={(event) => setUrl(event.target.value)} className="h-10 rounded-lg border border-[var(--line)] bg-[var(--canvas)] px-3 text-sm" placeholder="Verified public https feed URL" />
          <label className="text-xs font-bold">Feed format
            <select value={sourceType} onChange={(event) => setSourceType(event.target.value as DailyBriefSource["source_type"])} className="mt-2 h-10 w-full rounded-lg border border-[var(--line)] bg-[var(--canvas)] px-3 text-sm font-normal">
              <option value="rss">RSS</option>
              <option value="atom">Atom</option>
            </select>
          </label>
          <label className="text-xs font-bold">Priority <output className="ml-2 text-[var(--accent)]">{priority}</output>
            <input className="mt-2 w-full" type="range" min="0" max="100" value={priority} onChange={(event) => setPriority(Number(event.target.value))} />
          </label>
          <Button disabled={!name.trim() || !url.startsWith("https://")} onClick={() => void addBriefSource({ name: name.trim(), feed_url: url.trim(), source_type: sourceType, priority }).then(() => { setName(""); setUrl(""); setSourceType("rss"); load(); }).catch((caught) => setMessage(caught instanceof Error ? caught.message : "Could not add source."))}><Plus size={15} /> Add source</Button>
        </div>
      </Card>
    </section>

    <section className="mt-8">
      <h2 className="text-2xl font-bold">Candidate queue</h2>
      <div className="mt-4 space-y-3">
        {candidates.map((item) => <Card key={item.id} className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--ink-faint)]">Source: {item.source_name} · {sourceDate(item.published_source_at)} · score {Math.round(item.teaching_score)} · {item.case_slugs.join(", ") || "No case link"}</p>
              <h3 className="mt-2 text-lg font-bold">{item.title}</h3>
              <p className="mt-3 text-[10px] font-bold uppercase tracking-wider text-[var(--ink-faint)]">Short RSS/Atom source summary · not AI-generated</p>
              <p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">{shortSourceSummary(item.summary)}</p>
              <a href={item.canonical_url} target="_blank" rel="noreferrer" onClick={() => setOpenedOriginals((current) => new Set(current).add(item.id))} className="mt-4 inline-flex items-center gap-2 text-xs font-bold text-[var(--accent)]">Open original source to verify <ExternalLink size={14} /></a>
              {!openedOriginals.has(item.id) && <p className="mt-2 text-[10px] text-[var(--ink-faint)]">Publishing is enabled after you open the original source for review.</p>}
            </div>
            <div className="flex gap-2">
              <Button size="sm" disabled={!openedOriginals.has(item.id)} onClick={() => void reviewBriefItem(item.id, "published").then(load).catch((caught) => setMessage(caught instanceof Error ? caught.message : "Could not publish."))}><Check size={14} /> Publish</Button>
              <Button size="sm" variant="danger" onClick={() => void reviewBriefItem(item.id, "rejected").then(load).catch((caught) => setMessage(caught instanceof Error ? caught.message : "Could not reject."))}><X size={14} /> Reject</Button>
            </div>
          </div>
        </Card>)}
        {candidates.length === 0 && <p className="rounded-xl border border-dashed border-[var(--line)] p-10 text-center text-sm text-[var(--ink-muted)]">No candidate briefs waiting for review.</p>}
      </div>
    </section>

    <section className="mt-8 grid gap-5 lg:grid-cols-2">
      <Card className="p-5">
        <h2 className="text-lg font-bold">Sources</h2>
        <div className="mt-4 space-y-3">
          {sources.map((source) => <div key={source.id} className="flex items-center justify-between gap-4 border-b border-[var(--line)] pb-3 last:border-0">
            <div className="min-w-0"><p className="truncate text-sm font-bold">{source.name}</p><p className="truncate text-[10px] text-[var(--ink-faint)]">{source.feed_url} · priority {source.priority}</p></div>
            <button type="button" onClick={() => void setBriefSourceEnabled(source.id, !source.enabled).then(load).catch((caught) => setMessage(caught instanceof Error ? caught.message : "Could not update source."))} className={`rounded px-2 py-1 text-[10px] font-bold ${source.enabled ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "bg-[var(--surface-subtle)] text-[var(--ink-faint)]"}`}>{source.enabled ? "Enabled" : "Disabled"}</button>
          </div>)}
          {sources.length === 0 && <p className="text-sm text-[var(--ink-muted)]">No source configured.</p>}
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="text-lg font-bold">Recent jobs</h2>
        <div className="mt-4 space-y-3">
          {jobs.map((job) => <div key={job.id} className="border-b border-[var(--line)] pb-3 last:border-0"><p className="text-sm font-bold capitalize">{job.status} · {job.trigger_type}</p><p className="mt-1 text-[10px] text-[var(--ink-faint)]">{new Date(job.started_at).toLocaleString()} · {job.sources_checked} sources · {job.candidates_found} parsed{jobMetric(job, "freshCandidates") !== null ? ` · ${jobMetric(job, "freshCandidates")} current` : ""}{jobMetric(job, "duplicatesSkipped") !== null ? ` · ${jobMetric(job, "duplicatesSkipped")} duplicates` : ""} · {job.items_inserted} inserted{Array.isArray(job.metadata?.sourceFailures) && job.metadata.sourceFailures.length ? ` · ${job.metadata.sourceFailures.length} source failures` : ""}{job.error_message ? ` · ${job.error_message}` : ""}</p></div>)}
          {jobs.length === 0 && <p className="text-sm text-[var(--ink-muted)]">No jobs recorded.</p>}
        </div>
      </Card>
    </section>
  </main>;
}

function Gate({ title, text, action }: { title: string; text?: string; action?: () => void }) {
  return <main className="mx-auto grid min-h-[65vh] max-w-xl place-items-center px-5 text-center"><div><h1 className="text-3xl font-bold">{title}</h1>{text && <p className="mt-3 text-sm text-[var(--ink-muted)]">{text}</p>}{action && <Button className="mt-5" onClick={action}>Sign in</Button>}</div></main>;
}
