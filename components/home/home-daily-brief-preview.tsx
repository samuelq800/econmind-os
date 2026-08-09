"use client";

import Link from "next/link";
import { ArrowRight, CalendarDays, Newspaper } from "lucide-react";
import { useEffect, useState } from "react";
import type { DailyBriefItem } from "@/lib/daily-brief/types";
import { listPublishedBriefs } from "@/lib/supabase/daily-brief";

type BriefState =
  | { status: "loading" }
  | { status: "ready"; item: DailyBriefItem | null }
  | { status: "unavailable" };

export function HomeDailyBriefPreview() {
  const [state, setState] = useState<BriefState>({ status: "loading" });

  useEffect(() => {
    void listPublishedBriefs()
      .then((items) => setState({ status: "ready", item: items[0] ?? null }))
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
        <h3>The next reviewed briefing is on its way.</h3>
        <p>Daily Brief only presents items that have passed the teacher review workflow. Browse the archive as new items are published.</p>
        <Link href="/daily-brief" className="home-text-link">Open Daily Brief <ArrowRight size={15} /></Link>
      </div>
    );
  }

  const modelHref = item.case_slugs[0] ? `/cases/${item.case_slugs[0]}` : "/models";
  return (
    <article className="home-brief-card">
      <div className="flex flex-wrap items-center gap-2 text-[10px] font-extrabold uppercase tracking-[.14em] text-[var(--ink-faint)]">
        <span className="inline-flex items-center gap-1"><CalendarDays size={12} />{new Date(item.published_at ?? item.created_at).toLocaleDateString()}</span>
        <span>·</span><span>{item.source_name}</span>
      </div>
      <h3>{item.title}</h3>
      <p>{item.summary}</p>
      <div className="mt-5 flex flex-wrap gap-2">
        <Link href={`/daily-brief/read?brief=${encodeURIComponent(item.slug)}`} className="home-text-link">Read briefing <ArrowRight size={15} /></Link>
        <Link href={modelHref} className="home-text-link home-text-link-secondary">Test in a model <ArrowRight size={15} /></Link>
      </div>
    </article>
  );
}
