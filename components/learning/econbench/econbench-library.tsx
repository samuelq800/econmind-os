"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  Filter,
  Layers3,
  SlidersHorizontal,
  Target,
} from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChallengePreview } from "@/components/learning/econbench/challenge-preview";
import {
  ECONBENCH_CHALLENGES,
  humanize,
  slugForChallenge,
  type EconBenchChallenge,
} from "@/lib/economics/econbench";
import {
  econBenchProgressKey,
  listEconBenchProgress,
  type EconBenchProgressRow,
} from "@/lib/supabase/econbench";

type FilterValue =
  | "All"
  | "Macroeconomics"
  | "Microeconomics"
  | "International Economics"
  | "Behavioural Economics"
  | "Econometrics"
  | "Operations"
  | "Not Started"
  | "In Progress"
  | "Completed";
type SortValue =
  | "Recommended"
  | "Difficulty"
  | "Estimated time"
  | "Progress"
  | "Recently opened";

const filters: FilterValue[] = [
  "All",
  "Macroeconomics",
  "Microeconomics",
  "International Economics",
  "Behavioural Economics",
  "Econometrics",
  "Operations",
  "Not Started",
  "In Progress",
  "Completed",
];
const minutes = (value: string) => Number(value.match(/\d+/)?.[0] ?? 0);
const difficulty = (value: EconBenchChallenge["meta"]["difficulty"]) =>
  ({ Foundation: 1, Intermediate: 2, Advanced: 3 })[value];

function progressFor(
  challenge: EconBenchChallenge,
  progress: Map<string, EconBenchProgressRow>,
) {
  const row = progress.get(econBenchProgressKey(challenge.challenge_id));
  if (!row) return { label: "Not Started", percentage: 0, row: undefined };
  return {
    label: row.status === "completed" ? "Completed" : "In Progress",
    percentage: row.progress_percent,
    row,
  };
}

export function EconBenchLibrary() {
  const { user } = useAuth();
  const [filter, setFilter] = useState<FilterValue>("All");
  const [sort, setSort] = useState<SortValue>("Recommended");
  const [rows, setRows] = useState<EconBenchProgressRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) {
      queueMicrotask(() => setRows([]));
      return;
    }
    queueMicrotask(() => setLoading(true));
    void listEconBenchProgress(user.id)
      .then((nextRows) => queueMicrotask(() => setRows(nextRows)))
      .catch(() => queueMicrotask(() => setRows([])))
      .finally(() => queueMicrotask(() => setLoading(false)));
  }, [user]);

  const progress = useMemo(
    () => new Map(rows.map((row) => [row.model_key, row])),
    [rows],
  );
  const completed = rows.filter((row) => row.status === "completed").length;
  const attempted = rows.filter((row) => row.status !== "not_started").length;
  const accuracy = attempted ? Math.round((completed / attempted) * 100) : 0;
  const commonError =
    rows
      .filter((row) => row.last_parameters.finalResult === "incorrect")
      .map((row) => row.last_parameters.lastErrorCategory)
      .filter(Boolean)[0] ?? "No recorded error";
  const visible = useMemo(
    () =>
      ECONBENCH_CHALLENGES.filter((challenge) => {
        const state = progressFor(challenge, progress).label;
        return (
          filter === "All" ||
          challenge.meta.category === filter ||
          state === filter
        );
      }).sort((left, right) => {
        if (sort === "Difficulty")
          return (
            difficulty(left.meta.difficulty) - difficulty(right.meta.difficulty)
          );
        if (sort === "Estimated time")
          return minutes(left.meta.minutes) - minutes(right.meta.minutes);
        if (sort === "Progress")
          return (
            progressFor(right, progress).percentage -
            progressFor(left, progress).percentage
          );
        if (sort === "Recently opened")
          return String(
            progressFor(right, progress).row?.updated_at ?? "",
          ).localeCompare(
            String(progressFor(left, progress).row?.updated_at ?? ""),
          );
        return left.challenge_id.localeCompare(right.challenge_id);
      }),
    [filter, progress, sort],
  );

  return (
    <main className="mx-auto min-h-[calc(100vh-4rem)] max-w-7xl px-5 py-7 sm:px-8 lg:px-10">
      <header className="border-b border-[var(--line)] pb-6">
        <p className="text-[10px] font-extrabold tracking-[.14em] text-[var(--accent)]">
          LEARNING SYSTEM · MULTI-MODEL CHALLENGES
        </p>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-5">
          <div>
            <h1 className="text-4xl font-bold tracking-[-.055em] sm:text-5xl">
              EconBench
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--ink-muted)]">
              Apply multiple economic models, design a policy response, and
              satisfy measurable goals under real constraints.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-xs sm:grid-cols-4">
            {[
              ["10", "preset challenges"],
              [String(completed), "completed"],
              [`${accuracy}%`, "average accuracy"],
              [String(commonError), "common error"],
            ].map(([number, label]) => (
              <div key={label}>
                <p className="text-lg font-bold text-[var(--accent)]">
                  {number}
                </p>
                <p className="text-[10px] text-[var(--ink-muted)]">{label}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-2 text-[10px] font-bold text-[var(--ink-muted)]">
          {[
            "Understand the shock",
            "Select models",
            "Design intervention",
            "Test outcomes",
            "Submit decision",
          ].map((step, index) => (
            <span key={step} className="flex items-center gap-2">
              <span className="rounded-md bg-[var(--surface-subtle)] px-2 py-1">
                {step}
              </span>
              {index < 4 && (
                <ArrowRight size={12} className="text-[var(--accent)]" />
              )}
            </span>
          ))}
        </div>
      </header>
      <section className="mt-6 flex flex-col gap-3 border-b border-[var(--line)] pb-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-1">
          {filters.map((item) => (
            <button
              key={item}
              onClick={() => setFilter(item)}
              className={`rounded-md px-2.5 py-1.5 text-xs font-bold ${filter === item ? "bg-[var(--accent)] text-white" : "text-[var(--ink-muted)] hover:bg-[var(--surface-subtle)]"}`}
            >
              {item}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-xs font-bold text-[var(--ink-muted)]">
          <Filter size={14} />
          Sort
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as SortValue)}
            className="h-8 rounded-md border border-[var(--line)] bg-[var(--surface)] px-2 text-xs text-[var(--ink)]"
          >
            {(
              [
                "Recommended",
                "Difficulty",
                "Estimated time",
                "Progress",
                "Recently opened",
              ] as SortValue[]
            ).map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
      </section>
      <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {visible.map((challenge, index) => (
          <ChallengeCard
            key={challenge.challenge_id}
            challenge={challenge}
            number={index + 1}
            progress={progressFor(challenge, progress)}
          />
        ))}
      </section>
      {loading && (
        <p className="mt-4 text-xs text-[var(--ink-muted)]">
          Refreshing saved challenge progress…
        </p>
      )}
    </main>
  );
}

function ChallengeCard({
  challenge,
  number,
  progress,
}: {
  challenge: EconBenchChallenge;
  number: number;
  progress: ReturnType<typeof progressFor>;
}) {
  return (
    <article className="flex min-w-0 flex-col rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[var(--shadow)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold tracking-wide text-[var(--accent)]">
            CHALLENGE {String(number).padStart(2, "0")} ·{" "}
            {challenge.challenge_id}
          </p>
          <h2 className="mt-2 text-lg font-bold tracking-[-.025em]">
            {challenge.title}
          </h2>
        </div>
        <Badge>{challenge.meta.difficulty}</Badge>
      </div>
      <p className="mt-2 min-h-10 text-xs leading-5 text-[var(--ink-muted)]">
        {challenge.meta.situation}
      </p>
      <div className="mt-3">
        <ChallengePreview challenge={challenge} />
      </div>
      <div className="mt-4 flex flex-wrap gap-1.5">
        <Badge className="bg-[var(--accent-soft)] text-[var(--accent)]">
          {challenge.meta.category}
        </Badge>
        <Badge>{challenge.territory}</Badge>
        <span className="inline-flex items-center gap-1 text-[10px] text-[var(--ink-muted)]">
          <Clock3 size={11} />
          {challenge.meta.minutes}
        </span>
      </div>
      <dl className="mt-4 space-y-2 border-y border-[var(--line)] py-3 text-[10px]">
        <div className="grid grid-cols-[70px_1fr] gap-2">
          <dt className="flex items-center gap-1 font-bold text-[var(--ink-faint)]">
            <Layers3 size={11} />
            Models
          </dt>
          <dd className="font-semibold text-[var(--ink-muted)]">
            {challenge.model_options.slice(0, 3).map(humanize).join(" · ")}
          </dd>
        </div>
        <div className="grid grid-cols-[70px_1fr] gap-2">
          <dt className="flex items-center gap-1 font-bold text-[var(--ink-faint)]">
            <Target size={11} />
            Goal
          </dt>
          <dd>{challenge.meta.objective}</dd>
        </div>
        <div className="grid grid-cols-[70px_1fr] gap-2">
          <dt className="flex items-center gap-1 font-bold text-[var(--ink-faint)]">
            <SlidersHorizontal size={11} />
            Constraint
          </dt>
          <dd>{challenge.meta.constraint}</dd>
        </div>
      </dl>
      <div className="mt-4 flex items-center justify-between gap-3">
        <div>
          <p className="flex items-center gap-1 text-[10px] font-bold text-[var(--ink-muted)]">
            {progress.label === "Completed" && (
              <CheckCircle2 size={12} className="text-[var(--accent)]" />
            )}
            {progress.label}
          </p>
          <p className="mt-1 text-[10px] text-[var(--ink-faint)]">
            Best result:{" "}
            {progress.label === "Completed"
              ? "Correct"
              : progress.percentage
                ? `${progress.percentage}% workspace`
                : "—"}
          </p>
        </div>
        <Link href={`/econbench/${slugForChallenge(challenge.challenge_id)}`}>
          <Button size="sm">
            {progress.percentage ? "Continue" : "Start"}
            <ArrowRight size={13} />
          </Button>
        </Link>
      </div>
    </article>
  );
}
