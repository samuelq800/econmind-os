"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BookOpenCheck, Cloud, Heart, LoaderCircle, LogIn, Trash2 } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import {
  deleteModelRun,
  listFavorites,
  listLearningProgress,
  listModelRuns,
  type FavoriteRow,
  type LearningProgressRow,
  type ModelKey,
  type ModelRunRow,
} from "@/lib/supabase/data";

const models: Record<ModelKey, { title: string; href: string }> = {
  "supply-demand": { title: "Supply & Demand", href: "/models/supply-demand" },
  policy: { title: "Indirect Tax & Subsidy", href: "/models/policy" },
  elasticity: { title: "Elasticity & Revenue", href: "/models/elasticity" },
};

const date = (value: string | null) => value
  ? new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
  : "Not yet";

export default function LibraryPage() {
  const { user, loading: authLoading, openAuth } = useAuth();
  const [runs, setRuns] = useState<ModelRunRow[]>([]);
  const [favorites, setFavorites] = useState<FavoriteRow[]>([]);
  const [progress, setProgress] = useState<LearningProgressRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) {
      queueMicrotask(() => {
        setRuns([]);
        setFavorites([]);
        setProgress([]);
      });
      return;
    }
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      setLoading(true);
      setError("");
    });
    void Promise.all([
      listModelRuns(user.id),
      listFavorites(user.id),
      listLearningProgress(user.id),
    ])
      .then(([nextRuns, nextFavorites, nextProgress]) => {
        if (!active) return;
        setRuns(nextRuns);
        setFavorites(nextFavorites);
        setProgress(nextProgress);
      })
      .catch((caught) => {
        if (active) setError(caught instanceof Error ? caught.message : "Could not load your cloud library.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [user]);

  async function removeRun(runId: string) {
    if (!user) return;
    setError("");
    try {
      await deleteModelRun(user.id, runId);
      setRuns((current) => current.filter((run) => run.id !== runId));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not delete this run.");
    }
  }

  if (authLoading) {
    return <main className="grid min-h-[60vh] place-items-center"><LoaderCircle className="animate-spin text-[var(--accent)]" /></main>;
  }

  if (!user) {
    return (
      <main className="mx-auto grid min-h-[65vh] max-w-xl place-items-center px-5 py-20 text-center">
        <div>
          <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]"><Cloud size={24} /></span>
          <h1 className="mt-6 text-4xl font-bold tracking-[-.05em]">Your private cloud library</h1>
          <p className="mt-4 text-sm leading-7 text-[var(--ink-muted)]">Sign in to see named model runs, favorites, and learning progress. Browser-only parameters remain available without an account.</p>
          <Button className="mt-7" onClick={() => openAuth("sign-in")}><LogIn size={15} />Sign in</Button>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-[calc(100vh-4rem)] max-w-6xl px-5 py-12 sm:px-8 lg:py-16">
      <div className="flex flex-col justify-between gap-5 border-b border-[var(--line)] pb-10 sm:flex-row sm:items-end">
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-[.18em] text-[var(--accent)]">Supabase workspace</p>
          <h1 className="mt-3 text-4xl font-bold tracking-[-.05em] sm:text-5xl">My Library</h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-[var(--ink-muted)]">Private records for <span className="font-semibold text-[var(--ink)]">{user.email}</span>. Row Level Security limits every query to this account.</p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          {[[runs.length, "Runs"], [favorites.length, "Favorites"], [progress.length, "In progress"]].map(([value, label]) => (
            <div key={String(label)} className="min-w-20 rounded-lg border border-[var(--line)] bg-[var(--surface)] p-3">
              <p className="text-xl font-bold">{value}</p><p className="text-[9px] font-bold uppercase tracking-wider text-[var(--ink-faint)]">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {error && <p role="alert" className="mt-6 rounded-xl border border-[var(--red)] bg-[var(--red-soft)] p-4 text-sm text-[var(--red)]">{error}</p>}
      {loading ? (
        <div className="grid min-h-72 place-items-center"><LoaderCircle className="animate-spin text-[var(--accent)]" /></div>
      ) : (
        <div className="mt-10 grid gap-8 lg:grid-cols-[1.5fr_1fr]">
          <section>
            <div className="flex items-center gap-2"><Cloud size={17} className="text-[var(--accent)]" /><h2 className="text-lg font-bold">Named runs</h2></div>
            <div className="mt-4 space-y-3">
              {runs.length === 0 && <EmptyState text="Save a named scenario from any model and it will appear here." />}
              {runs.map((run) => (
                <article key={run.id} className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <Link href={models[run.model_key]?.href ?? "/models"} className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--accent)]">{models[run.model_key]?.title ?? run.model_key}</Link>
                      <h3 className="mt-1 text-base font-bold">{run.name}</h3>
                      <p className="mt-1 text-[10px] text-[var(--ink-faint)]">Saved {date(run.created_at)}</p>
                    </div>
                    <button type="button" aria-label={`Delete ${run.name}`} onClick={() => void removeRun(run.id)} className="grid size-8 place-items-center rounded-lg text-[var(--ink-faint)] hover:bg-[var(--red-soft)] hover:text-[var(--red)]"><Trash2 size={14} /></button>
                  </div>
                  <details className="mt-4 rounded-lg bg-[var(--surface-subtle)] px-3 py-2 text-xs">
                    <summary className="cursor-pointer font-semibold text-[var(--ink-muted)]">View saved parameters and results</summary>
                    <div className="mt-3 grid gap-4 sm:grid-cols-2">
                      <DataList title="Parameters" data={run.parameters} />
                      <DataList title="Results" data={run.results} />
                    </div>
                  </details>
                </article>
              ))}
            </div>
          </section>

          <div className="space-y-8">
            <section>
              <div className="flex items-center gap-2"><Heart size={17} className="text-[var(--red)]" /><h2 className="text-lg font-bold">Favorite models</h2></div>
              <div className="mt-4 overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)]">
                {favorites.length === 0 && <EmptyState text="Use the favorite button at the top of a model." compact />}
                {favorites.map((favorite) => (
                  <Link key={favorite.id} href={models[favorite.model_key]?.href ?? "/models"} className="flex items-center justify-between border-b border-[var(--line)] px-4 py-4 text-sm font-semibold last:border-0">
                    {models[favorite.model_key]?.title ?? favorite.model_key}<span className="text-[var(--accent)]">Open →</span>
                  </Link>
                ))}
              </div>
            </section>

            <section>
              <div className="flex items-center gap-2"><BookOpenCheck size={17} className="text-[var(--blue)]" /><h2 className="text-lg font-bold">Learning progress</h2></div>
              <div className="mt-4 space-y-3">
                {progress.length === 0 && <EmptyState text="Open a model while signed in to begin tracking progress." compact />}
                {progress.map((item) => (
                  <div key={item.id} className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4">
                    <div className="flex justify-between gap-3 text-xs font-bold"><span>{models[item.model_key]?.title ?? item.model_key}</span><span className="text-[var(--accent)]">{item.progress_percent}%</span></div>
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--surface-strong)]"><div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${item.progress_percent}%` }} /></div>
                    <p className="mt-2 text-[10px] text-[var(--ink-faint)]">Last visited {date(item.last_visited_at)}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      )}
    </main>
  );
}

function EmptyState({ text, compact = false }: { text: string; compact?: boolean }) {
  return <p className={`rounded-xl border border-dashed border-[var(--line-strong)] bg-[var(--canvas)] text-center text-xs leading-5 text-[var(--ink-muted)] ${compact ? "p-5" : "p-8"}`}>{text}</p>;
}

function DataList({ title, data }: { title: string; data: Record<string, number> }) {
  return (
    <div>
      <p className="mb-2 text-[9px] font-bold uppercase tracking-wider text-[var(--ink-faint)]">{title}</p>
      <dl className="space-y-1.5">
        {Object.entries(data).map(([key, value]) => <div key={key} className="flex justify-between gap-3"><dt className="truncate text-[var(--ink-muted)]">{key}</dt><dd className="font-semibold">{new Intl.NumberFormat("en", { maximumFractionDigits: 2 }).format(value)}</dd></div>)}
      </dl>
    </div>
  );
}
