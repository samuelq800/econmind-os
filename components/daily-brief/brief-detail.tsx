"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, ExternalLink, FlaskConical } from "lucide-react";
import { Card } from "@/components/ui/card";
import { CASE_BY_SLUG } from "@/lib/cases/definitions";
import type { DailyBriefItem } from "@/lib/daily-brief/types";
import { getPublishedBrief } from "@/lib/supabase/daily-brief";

type LoadedBrief = { slug: string; item: DailyBriefItem | null; error: string | null };

export function BriefDetail({ slug }: { slug: string }) {
  const [record, setRecord] = useState<LoadedBrief>({ slug: "", item: null, error: null });
  useEffect(() => {
    let active = true;
    void getPublishedBrief(slug)
      .then((item) => { if (active) setRecord({ slug, item, error: null }); })
      .catch((caught) => { if (active) setRecord({ slug, item: null, error: caught instanceof Error ? caught.message : "Could not load briefing." }); });
    return () => { active = false; };
  }, [slug]);

  if (record.slug !== slug) return <main className="mx-auto min-h-[65vh] max-w-3xl px-5 py-12"><p className="text-sm text-[var(--ink-muted)]">Loading briefing…</p></main>;
  if (record.error) return <BriefState title="Could not load this briefing." text={record.error} />;
  if (!record.item) return <BriefState title="This briefing is not published." text="It may still be in review, archived, or unavailable in a static deployment." />;
  const item = record.item;
  return <main className="mx-auto min-h-screen max-w-3xl px-5 py-12 sm:px-8">
    <BackLink />
    <header className="mt-8"><p className="text-[10px] font-bold uppercase tracking-[.18em] text-[var(--accent)]">{item.source_name} · {new Date(item.published_at ?? item.created_at).toLocaleDateString()}</p><h1 className="mt-3 text-4xl font-bold tracking-[-.05em]">{item.title}</h1><div className="mt-4 flex flex-wrap gap-1.5">{item.topic_tags.map((tag) => <span key={tag} className="rounded bg-[var(--accent-soft)] px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-[var(--accent)]">{tag}</span>)}</div></header>
    <article className="mt-8 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-6 text-base leading-8 text-[var(--ink-muted)]"><p>{item.summary}</p><a href={item.canonical_url} target="_blank" rel="noreferrer" className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-[var(--accent)]">Read the original source <ExternalLink size={14} /></a></article>
    <Card className="mt-6 p-5"><div className="flex items-center gap-2 text-sm font-bold"><FlaskConical size={16} className="text-[var(--accent)]" /> Try a related case</div><p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">The link is keyword-based and intentionally labelled as a teaching connection, not a causal conclusion.</p><div className="mt-4 flex flex-wrap gap-2">{item.case_slugs.map((caseSlug) => CASE_BY_SLUG[caseSlug] ? <Link key={caseSlug} href={`/cases/${caseSlug}`} className="rounded-lg border border-[var(--accent)] px-3 py-2 text-xs font-bold text-[var(--accent)]">{CASE_BY_SLUG[caseSlug].title}</Link> : null)}{item.case_slugs.length === 0 && <span className="text-xs text-[var(--ink-faint)]">No direct case match was assigned.</span>}</div></Card>
    <p className="mt-6 text-xs leading-5 text-[var(--ink-faint)]">Teaching relevance score: {Math.round(item.teaching_score)}/100. This score uses source, topic, and summary signals only; it is not a measure of truth, importance, or policy quality.</p>
  </main>;
}

function BackLink() { return <Link className="inline-flex items-center gap-2 text-xs font-bold text-[var(--ink-muted)] hover:text-[var(--ink)]" href="/daily-brief"><ArrowLeft size={14} /> Daily Brief</Link>; }
function BriefState({ title, text }: { title: string; text: string }) { return <main className="mx-auto min-h-[65vh] max-w-3xl px-5 py-12"><BackLink /><h1 className="mt-8 text-3xl font-bold">{title}</h1><p className="mt-3 text-sm leading-6 text-[var(--ink-muted)]">{text}</p></main>; }
