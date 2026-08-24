"use client";

import Link from "next/link";
import { ArrowRight, CalendarDays, ExternalLink, Newspaper } from "lucide-react";
import { useEffect, useState } from "react";
import type { DailyBriefItem } from "@/lib/daily-brief/types";
import { isFreshCandidate } from "@/lib/daily-brief/rules";
import { listPublishedBriefs } from "@/lib/supabase/daily-brief";

type BriefState =
  | { status: "loading" }
  | { status: "ready"; item: DailyBriefItem | null }
  | { status: "unavailable" };

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

export function HomeDailyBriefPreview() {
  const [state, setState] = useState<BriefState>({ status: "loading" });

  useEffect(() => {
    void listPublishedBriefs()
      .then((items) => setState({ status: "ready", item: items.find((candidate) => isFreshCandidate({ publishedSourceAt: candidate.published_source_at })) ?? null }))
      .catch(() => setState({ status: "unavailable" }));
  }, []);

  if (state.status === "loading") {
    return <div className="home-brief-card home-brief-loading" aria-live="polite"><Newspaper size={20} /><p>Loading the latest reviewed brief…</p></div>;
  }

  const item = state.status === "ready" ? state.item : null;
  if (!item) {
    return (
      <div className="home-brief-card">
        <p className="home-card-eyebrow">Daily Brief</p>
        <h3>The next current, reviewed briefing is on its way.</h3>
        <p>Daily Brief does not present older news as current. Browse the archive while newly collected items complete source review.</p>
        <Link href="/daily-brief" className="home-text-link">Open Daily Brief <ArrowRight size={15} /></Link>
      </div>
    );
  }

  const modelHref = item.case_slugs[0] ? `/cases/${item.case_slugs[0]}` : "/models";
  return (
    <article className="home-brief-card">
      <div className="flex flex-wrap items-center gap-2 text-[10px] font-extrabold uppercase tracking-[.14em] text-[var(--ink-faint)]">
        <span className="inline-flex items-center gap-1"><CalendarDays size={12} />{sourceDate(item.published_source_at)}</span>
        <span>·</span><span>Source: {item.source_name}</span>
      </div>
      <h3>{item.title}</h3>
      <p className="mt-3 text-[10px] font-bold uppercase tracking-wider text-[var(--ink-faint)]">Short RSS/Atom source summary · not AI-generated</p>
      <p>{shortSourceSummary(item.summary)}</p>
      <p className="mt-3 text-xs leading-5 text-[var(--ink-faint)]">Source attribution does not imply endorsement, affiliation, or partnership with EconMind OS.</p>
      <div className="mt-5 flex flex-wrap gap-3">
        <Link href={`/daily-brief/read?brief=${encodeURIComponent(item.slug)}`} className="home-text-link">Read briefing <ArrowRight size={15} /></Link>
        <a href={item.canonical_url} target="_blank" rel="noreferrer" className="home-text-link home-text-link-secondary">Original source <ExternalLink size={15} /></a>
        <Link href={modelHref} className="home-text-link home-text-link-secondary">Test in a model <ArrowRight size={15} /></Link>
      </div>
    </article>
  );
}
