"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, Clock3, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { MODEL_ICONS } from "@/lib/models/icons";
import { MODEL_REGISTRY, type ModelCategory, type ModelDifficulty, type ModelStatus } from "@/lib/models/registry";

const categories: Array<"All" | ModelCategory> = ["All", "Markets", "Policy", "Firms", "Macro", "Behavioral", "Sandbox"];
const difficulties: Array<"All" | ModelDifficulty> = ["All", "Beginner", "Intermediate", "Advanced"];
const statuses: Array<{ value: "all" | ModelStatus; label: string }> = [
  { value: "all", label: "All" },
  { value: "available", label: "Available" },
  { value: "coming-soon", label: "Coming soon" },
];

export default function ModelsPage() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<"All" | ModelCategory>("All");
  const [difficulty, setDifficulty] = useState<"All" | ModelDifficulty>("All");
  const [status, setStatus] = useState<"all" | ModelStatus>("available");
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return MODEL_REGISTRY.filter((model) =>
      (category === "All" || model.category === category)
      && (difficulty === "All" || model.difficulty === difficulty)
      && (status === "all" || model.status === status)
      && (!needle || [model.title, model.shortTitle, model.description, ...model.concepts].some((value) => value.toLowerCase().includes(needle))),
    );
  }, [query, category, difficulty, status]);

  return <div className="min-h-[calc(100vh-4rem)] p-5 sm:p-8 lg:p-10">
    <div className="max-w-3xl">
      <p className="text-[10px] font-extrabold uppercase tracking-[.18em] text-[var(--accent)]">Model library</p>
      <h1 className="mt-3 text-4xl font-bold tracking-[-.05em] sm:text-5xl">Economic mechanisms, made observable.</h1>
      <p className="mt-5 text-base leading-7 text-[var(--ink-muted)]">Search by topic, category, or difficulty. Every available model calculates instantly in your browser.</p>
    </div>

    <section aria-label="Model filters" className="mt-10 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4 sm:p-5">
      <label className="relative block">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-faint)]" />
        <span className="sr-only">Search models</span>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search models or concepts" className="h-11 w-full rounded-lg border border-[var(--line-strong)] bg-[var(--canvas)] pl-10 pr-3 text-sm outline-none focus:border-[var(--accent)]" />
      </label>
      <div className="mt-4 grid gap-4 lg:grid-cols-[1.35fr_1fr_.8fr]">
        <FilterGroup label="Category" values={categories} value={category} onChange={(value) => setCategory(value as typeof category)} />
        <FilterGroup label="Difficulty" values={difficulties} value={difficulty} onChange={(value) => setDifficulty(value as typeof difficulty)} />
        <FilterGroup label="Availability" values={statuses.map((item) => item.value)} labels={Object.fromEntries(statuses.map((item) => [item.value, item.label]))} value={status} onChange={(value) => setStatus(value as typeof status)} />
      </div>
    </section>

    <div className="mt-8 flex items-center justify-between border-b border-[var(--line)] pb-3 text-[10px] font-bold uppercase tracking-wider text-[var(--ink-faint)]"><span>{filtered.length} models</span><button type="button" onClick={() => { setQuery(""); setCategory("All"); setDifficulty("All"); setStatus("available"); }} className="text-[var(--accent)]">Reset filters</button></div>
    <div className="divide-y divide-[var(--line)] border-b border-[var(--line)]">
      {filtered.map((model) => {
        const Icon = MODEL_ICONS[model.icon];
        const content = <>
          <span className="text-xs font-bold text-[var(--ink-faint)]">{model.number}</span>
          <div className="flex gap-4">
            <span className="hidden size-11 shrink-0 place-items-center rounded-lg border border-[var(--line)] bg-[var(--surface)] text-[var(--accent)] sm:grid"><Icon size={19} /></span>
            <div>
              <div className="flex flex-wrap items-center gap-2"><h2 className="text-lg font-bold">{model.title}</h2><Badge>{model.difficulty}</Badge><Badge className={model.status === "available" ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "bg-[var(--amber-soft)] text-[var(--amber)]"}>{model.status === "available" ? "Available" : "Coming soon"}</Badge></div>
              <p className="mt-1 text-xs font-semibold text-[var(--ink-faint)]">{model.shortTitle}</p>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--ink-muted)]">{model.description}</p>
              <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-[var(--ink-muted)]"><span className="inline-flex items-center gap-1"><Clock3 size={11} />{model.estimatedMinutes} min</span>{model.concepts.map((concept) => <span key={concept}>· {concept}</span>)}</div>
            </div>
          </div>
          <span className={`flex items-center gap-2 text-xs font-bold ${model.status === "available" ? "text-[var(--accent)]" : "text-[var(--ink-faint)]"}`}>{model.status === "available" ? <>Open <ArrowRight size={15} /></> : "Planned"}</span>
        </>;
        const className = "group grid gap-5 py-7 sm:grid-cols-[60px_1fr_auto] sm:items-center sm:px-4";
        return model.status === "available" ? <Link key={model.slug} href={model.route} className={className}>{content}</Link> : <article key={model.slug} className={`${className} opacity-75`}>{content}</article>;
      })}
      {filtered.length === 0 && <div className="py-16 text-center"><p className="text-sm font-bold">No models match these filters.</p><p className="mt-2 text-xs text-[var(--ink-muted)]">Try a different category, difficulty, or search phrase.</p></div>}
    </div>
  </div>;
}

function FilterGroup({ label, values, labels, value, onChange }: { label: string; values: readonly string[]; labels?: Record<string, string>; value: string; onChange: (value: string) => void }) {
  return <div><p className="mb-2 text-[9px] font-bold uppercase tracking-wider text-[var(--ink-faint)]">{label}</p><div className="flex flex-wrap gap-1.5">{values.map((item) => <button key={item} type="button" aria-pressed={value === item} onClick={() => onChange(item)} className={`rounded-md px-2.5 py-1.5 text-[10px] font-bold ${value === item ? "bg-[var(--accent)] text-white" : "bg-[var(--surface-subtle)] text-[var(--ink-muted)]"}`}>{labels?.[item] ?? item}</button>)}</div></div>;
}
