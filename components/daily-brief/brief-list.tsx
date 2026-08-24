"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, BookOpen, CalendarDays, ExternalLink, Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { listPublishedBriefs } from "@/lib/supabase/daily-brief";
import type { DailyBriefItem } from "@/lib/daily-brief/types";
import { isFreshCandidate } from "@/lib/daily-brief/rules";

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

export function BriefList({ archive = false }: { archive?: boolean }) {
  const [items, setItems] = useState<DailyBriefItem[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    void listPublishedBriefs()
      .then(setItems)
      .catch((caught) => setError(caught instanceof Error ? caught.message : "Daily Brief is not available yet."));
  }, []);

  const filtered = useMemo(() => {
    const text = query.trim().toLowerCase();
    return !text ? items : items.filter((item) => [item.title, item.summary, ...item.topic_tags].join(" ").toLowerCase().includes(text));
  }, [items, query]);
  const displayed = useMemo(
    () => archive ? filtered : filtered.filter((item) => isFreshCandidate({ publishedSourceAt: item.published_source_at })),
    [archive, filtered],
  );

  return <main className="mx-auto min-h-screen max-w-6xl px-5 py-10 sm:px-8">
    <header className="max-w-3xl">
      <p className="text-[10px] font-bold uppercase tracking-[.18em] text-[var(--accent)]">Daily Brief {archive ? "archive" : ""}</p>
      <h1 className="mt-3 text-4xl font-bold tracking-[-.05em] sm:text-5xl">{archive ? "Browse published economic briefings." : "Current economic context, ready for a model."}</h1>
      <p className="mt-4 text-base leading-7 text-[var(--ink-muted)]">Items come from teacher-configured public RSS/Atom feeds and remain private until teacher review. Each excerpt below is a shortened source-provided feed summary, not an AI-generated summary.</p>
      <p className="mt-2 text-xs leading-5 text-[var(--ink-faint)]">Source attribution identifies the publisher only; it does not imply endorsement, affiliation, or partnership with EconMind OS.</p>
    </header>

    <label className="relative mt-8 block max-w-xl">
      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-faint)]" />
      <input value={query} onChange={(event) => setQuery(event.target.value)} className="h-11 w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] pl-10 pr-3 text-sm outline-none focus:border-[var(--accent)]" placeholder="Search published briefs" />
    </label>

    {error && <p className="mt-5 rounded-lg bg-[var(--amber-soft)] p-4 text-sm text-[var(--amber)]">{error}</p>}

    <div className="mt-8 grid gap-4 md:grid-cols-2">
      {displayed.map((item) => <Card key={item.id} className="h-full p-5">
        <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-[var(--ink-faint)]">
          <span className="inline-flex items-center gap-1"><CalendarDays size={11} />{sourceDate(item.published_source_at)}</span>
          <span>·</span><span>Source: {item.source_name}</span>
          <span>·</span><span>Score {Math.round(item.teaching_score)}</span>
        </div>
        <h2 className="mt-4 text-xl font-bold leading-7">{item.title}</h2>
        <p className="mt-3 text-[10px] font-bold uppercase tracking-wider text-[var(--ink-faint)]">Short RSS/Atom source summary · not AI-generated</p>
        <p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">{shortSourceSummary(item.summary)}</p>
        <div className="mt-4 flex flex-wrap gap-1.5">{item.topic_tags.slice(0, 5).map((tag) => <span key={tag} className="rounded bg-[var(--accent-soft)] px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-[var(--accent)]">{tag}</span>)}</div>
        <div className="mt-5 flex flex-wrap gap-4 text-xs font-bold">
          <Link href={`/daily-brief/read?brief=${encodeURIComponent(item.slug)}`} className="inline-flex items-center gap-2 text-[var(--accent)]">Open briefing <ArrowRight size={14} /></Link>
          <a href={item.canonical_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-[var(--ink-muted)] hover:text-[var(--accent)]">Original source <ExternalLink size={14} /></a>
        </div>
      </Card>)}

      {!error && displayed.length === 0 && <Card className="md:col-span-2 p-12 text-center">
        <BookOpen className="mx-auto text-[var(--ink-faint)]" size={22} />
        <p className="mt-4 text-sm font-bold">{archive ? "No published brief is available yet." : "No current reviewed brief is available."}</p>
        <p className="mt-2 text-xs leading-5 text-[var(--ink-muted)]">{archive ? "A teacher can add a verified RSS/Atom source; every candidate stays private until teacher review." : "Daily Brief does not present older news as current. Newly collected items remain private until source review."}</p>
      </Card>}
    </div>

    {!archive && <p className="mt-8 text-center text-xs"><Link href="/daily-brief/archive" className="font-bold text-[var(--accent)]">Open the full archive</Link></p>}
  </main>;
}
