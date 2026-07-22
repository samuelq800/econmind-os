"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, BookOpenCheck, Clock3, Copy, FlaskConical, LoaderCircle, LogIn, Trash2 } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { MODEL_REGISTRY, getModel, type ModelCategory } from "@/lib/models/registry";
import { recommendNext } from "@/lib/recommendations";
import {
  deleteModelRun,
  duplicateModelRun,
  getProfile,
  listFavorites,
  listLearningProgress,
  listModelRuns,
  listRecentActivity,
  type FavoriteRow,
  type LearningProgressRow,
  type ModelRunRow,
  type ProfileRow,
  type RecentActivityRow,
} from "@/lib/supabase/data";

const categories: ModelCategory[] = ["Markets", "Policy", "Firms", "Macro", "Behavioral", "Sandbox"];
const formatDate = (value: string | null | undefined) => value ? new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "No activity yet";
const summary = (value: Record<string, unknown>) => Object.entries(value).filter(([, item]) => typeof item === "number").slice(0, 3);

export default function DashboardPage() {
  const { user, loading: authLoading, openAuth } = useAuth();
  const openedAuth = useRef(false);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [runs, setRuns] = useState<ModelRunRow[]>([]);
  const [progress, setProgress] = useState<LearningProgressRow[]>([]);
  const [activity, setActivity] = useState<RecentActivityRow[]>([]);
  const [favorites, setFavorites] = useState<FavoriteRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!authLoading && !user && !openedAuth.current) {
      openedAuth.current = true;
      openAuth("sign-in");
    }
  }, [authLoading, user, openAuth]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      setLoading(true);
      setError("");
    });
    void Promise.all([
      getProfile(user.id),
      listModelRuns(user.id),
      listLearningProgress(user.id),
      listRecentActivity(user.id),
      listFavorites(user.id),
    ])
      .then(([nextProfile, nextRuns, nextProgress, nextActivity, nextFavorites]) => {
        if (!active) return;
        setProfile(nextProfile);
        setRuns(nextRuns);
        setProgress(nextProgress);
        setActivity(nextActivity);
        setFavorites(nextFavorites);
      })
      .catch((caught) => {
        if (active) setError(caught instanceof Error ? caught.message : "Could not load the workspace.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [user]);

  const completed = progress.filter((item) => item.status === "completed");
  const recommendations = recommendNext(completed.map((item) => item.model_key));
  const recentModels = activity.filter((item) => item.activity_type === "visit").slice(0, 6);
  const experimentCount = activity.filter((item) => item.activity_type === "simulation_run").reduce((sum, item) => sum + item.event_count, 0);
  const latestVisit = recentModels[0]?.last_seen_at ?? progress[0]?.last_visited_at;
  const displayName = profile?.display_name || user?.email?.split("@")[0] || "Economist";
  const favoriteSet = useMemo(() => new Set(favorites.map((item) => item.model_key)), [favorites]);

  async function remove(run: ModelRunRow) {
    if (!user || !window.confirm(`Delete “${run.name}”? This cannot be undone.`)) return;
    try {
      await deleteModelRun(user.id, run.id);
      setRuns((current) => current.filter((item) => item.id !== run.id));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not delete the scenario.");
    }
  }

  async function duplicate(run: ModelRunRow) {
    if (!user) return;
    try {
      const copy = await duplicateModelRun(user.id, run);
      setRuns((current) => [copy, ...current]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not duplicate the scenario.");
    }
  }

  if (authLoading || (user && loading)) return <main className="grid min-h-[65vh] place-items-center"><LoaderCircle className="animate-spin text-[var(--accent)]" /></main>;
  if (!user) return <main className="mx-auto grid min-h-[65vh] max-w-xl place-items-center px-5 text-center"><div><LogIn className="mx-auto text-[var(--accent)]" /><h1 className="mt-5 text-4xl font-bold">Economist Workspace</h1><p className="mt-4 text-sm leading-6 text-[var(--ink-muted)]">Sign in to open your private dashboard.</p><Button className="mt-6" onClick={() => openAuth("sign-in")}>Sign in</Button></div></main>;

  return (
    <main className="mx-auto min-h-screen max-w-[1440px] px-5 py-10 sm:px-8 lg:px-10">
      <div className="border-b border-[var(--line)] pb-8">
        <p className="text-[10px] font-extrabold uppercase tracking-[.18em] text-[var(--accent)]">Economist Workspace</p>
        <h1 className="mt-2 text-4xl font-bold tracking-[-.05em]">Welcome back, {displayName}.</h1>
        <p className="mt-3 text-sm text-[var(--ink-muted)]">A compact view of your learning, experiments, and saved scenarios.</p>
      </div>

      {error && <p role="alert" className="mt-5 rounded-xl bg-[var(--red-soft)] p-4 text-sm text-[var(--red)]">{error}</p>}

      <section className="mt-7 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <OverviewCard label="Completed models" value={completed.length} icon={BookOpenCheck} />
        <OverviewCard label="Saved scenarios" value={runs.length} icon={FlaskConical} />
        <OverviewCard label="Simulation runs" value={experimentCount} icon={FlaskConical} />
        <OverviewCard label="Last visit" value={latestVisit ? formatDate(latestVisit) : "Not yet"} icon={Clock3} small />
      </section>

      <div className="mt-8 grid gap-7 xl:grid-cols-[1.35fr_.85fr]">
        <div className="space-y-7">
          <DashboardSection title="Continue learning">
            <div className="grid gap-3 md:grid-cols-2">
              {(progress.filter((item) => item.status !== "completed").slice(0, 4).length ? progress.filter((item) => item.status !== "completed").slice(0, 4) : [{ model_key: "supply-demand", progress_percent: 0, last_visited_at: null }]).map((item) => {
                const model = getModel(item.model_key);
                if (!model) return null;
                return <Link key={model.slug} href={model.route} className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5"><div className="flex justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-wider text-[var(--accent)]">{model.category}</p><h3 className="mt-1 font-bold">{model.title}</h3></div><span className="text-xs font-bold">{item.progress_percent}%</span></div><div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[var(--surface-strong)]"><div className="h-full bg-[var(--accent)]" style={{ width: `${item.progress_percent}%` }} /></div><div className="mt-4 flex items-center justify-between text-[10px] text-[var(--ink-faint)]"><span>{formatDate(item.last_visited_at)}</span><span className="font-bold text-[var(--accent)]">Continue →</span></div></Link>;
              })}
            </div>
          </DashboardSection>

          <DashboardSection title="Saved scenarios">
            <div className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)]">
              {runs.length === 0 && <p className="p-7 text-sm text-[var(--ink-muted)]">No saved scenarios yet. Save one from a model or the Sandbox.</p>}
              {runs.slice(0, 6).map((run) => {
                const model = getModel(run.model_key);
                const href = `${model?.route ?? "/models"}?run=${run.id}`;
                return <div key={run.id} className="border-b border-[var(--line)] p-5 last:border-0"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start"><div><p className="text-[10px] font-bold uppercase tracking-wider text-[var(--accent)]">{model?.title ?? run.model_key}</p><h3 className="mt-1 font-bold">{run.name}</h3><div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-[var(--ink-muted)]">{summary(run.results).map(([key, value]) => <span key={key}>{key}: <b>{Number(value).toFixed(2)}</b></span>)}</div><p className="mt-2 text-[10px] text-[var(--ink-faint)]">{formatDate(run.created_at)}</p></div><div className="flex gap-2"><Link href={href} className="inline-flex h-8 items-center rounded-lg bg-[var(--accent)] px-3 text-xs font-bold text-white">Open</Link><button aria-label={`Duplicate ${run.name}`} onClick={() => void duplicate(run)} className="grid size-8 place-items-center rounded-lg border border-[var(--line)]"><Copy size={13} /></button><button aria-label={`Delete ${run.name}`} onClick={() => void remove(run)} className="grid size-8 place-items-center rounded-lg border border-[var(--line)] text-[var(--red)]"><Trash2 size={13} /></button></div></div></div>;
              })}
            </div>
          </DashboardSection>
        </div>

        <div className="space-y-7">
          <DashboardSection title="Recently used">
            <div className="divide-y divide-[var(--line)] rounded-xl border border-[var(--line)] bg-[var(--surface)]">
              {recentModels.length === 0 && <p className="p-5 text-xs text-[var(--ink-muted)]">Open a model to begin your history.</p>}
              {recentModels.map((item) => { const model = getModel(item.module_slug); if (!model) return null; const saved = progress.find((entry) => entry.model_key === item.module_slug)?.last_parameters ?? {}; return <Link key={item.id} href={model.route} className="block p-4"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-bold">{model.title}</p><p className="mt-1 text-[9px] uppercase tracking-wider text-[var(--ink-faint)]">{model.category} · {formatDate(item.last_seen_at)}</p></div><ArrowRight size={14} className="text-[var(--accent)]" /></div>{summary(saved).length > 0 && <p className="mt-2 truncate text-[10px] text-[var(--ink-muted)]">{summary(saved).map(([key, value]) => `${key} ${value}`).join(" · ")}</p>}</Link>; })}
            </div>
          </DashboardSection>

          <DashboardSection title="Recommended next">
            <div className="space-y-3">{recommendations.map(({ model, reason, preset }) => <div key={model.slug} className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4"><div className="flex justify-between gap-3"><div><p className="text-xs font-bold">{model.title}</p><p className="mt-1 text-[11px] leading-5 text-[var(--ink-muted)]">{reason}</p>{preset && <p className="mt-2 text-[10px] font-bold text-[var(--accent)]">Preset: {preset}</p>}</div><span className="text-[9px] font-bold uppercase text-[var(--ink-faint)]">{model.status === "available" ? `${model.estimatedMinutes} min` : "Coming soon"}</span></div>{model.status === "available" && <Link href={model.route} className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-[var(--accent)]">Open <ArrowRight size={12} /></Link>}</div>)}</div>
          </DashboardSection>

          <DashboardSection title="Learning progress">
            <div className="space-y-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5">{categories.map((category) => { const models = MODEL_REGISTRY.filter((model) => model.category === category && model.status === "available"); const done = models.filter((model) => completed.some((item) => item.model_key === model.slug)).length; const percent = models.length ? Math.round(done / models.length * 100) : 0; return <div key={category}><div className="flex justify-between text-[10px] font-bold"><span>{category}</span><span>{percent}%</span></div><div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[var(--surface-strong)]"><div className="h-full bg-[var(--accent)]" style={{ width: `${percent}%` }} /></div></div>; })}</div>
          </DashboardSection>

          {favoriteSet.size > 0 && <Link href="/library" className="inline-flex items-center gap-2 text-xs font-bold text-[var(--accent)]">View {favoriteSet.size} favorites in My Library <ArrowRight size={13} /></Link>}
        </div>
      </div>
    </main>
  );
}

function OverviewCard({ label, value, icon: Icon, small = false }: { label: string; value: string | number; icon: typeof Clock3; small?: boolean }) {
  return <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4"><div className="flex items-center justify-between"><p className="text-[9px] font-bold uppercase tracking-wider text-[var(--ink-faint)]">{label}</p><Icon size={15} className="text-[var(--accent)]" /></div><p className={`mt-4 font-bold ${small ? "text-xs leading-5" : "text-2xl"}`}>{value}</p></div>;
}

function DashboardSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <section><h2 className="mb-3 text-sm font-bold">{title}</h2>{children}</section>;
}
