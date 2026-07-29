"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { BriefDetail } from "@/components/daily-brief/brief-detail";

const validBriefSlug = (value: string) => /^[a-z0-9-]{6,160}$/.test(value);

export function BriefReader() {
  const slug = useSearchParams().get("brief") ?? "";
  if (validBriefSlug(slug)) return <BriefDetail slug={slug} />;
  return <main className="mx-auto min-h-[65vh] max-w-3xl px-5 py-12 sm:px-8"><h1 className="text-3xl font-bold">Briefing not found</h1><p className="mt-3 text-sm leading-6 text-[var(--ink-muted)]">Open a published briefing from the Daily Brief list to read it here.</p><Link href="/daily-brief" className="mt-6 inline-flex text-sm font-bold text-[var(--accent)]">Back to Daily Brief</Link></main>;
}
