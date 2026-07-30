"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  BookOpenCheck,
  ChevronDown,
  ChevronUp,
  Database,
  FlaskConical,
  LockKeyhole,
  Network,
  SearchCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  EVIDENCE_PROJECTS,
  EVIDENCE_STEPS,
  evidenceProjectStorageKey,
  type EvidenceProject,
  type EvidenceStepId,
} from "@/lib/evidence-lab/projects";

type StoredProgress = { completedSteps?: EvidenceStepId[]; complete?: boolean };

export function EvidenceLabOverview() {
  const [progress, setProgress] = useState<Record<string, StoredProgress>>({});
  useEffect(() => {
    const next = Object.fromEntries(
      EVIDENCE_PROJECTS.map((project) => {
        try {
          return [
            project.slug,
            JSON.parse(
              window.localStorage.getItem(evidenceProjectStorageKey(project)) ??
                "{}",
            ),
          ] as const;
        } catch {
          return [project.slug, {}] as const;
        }
      }),
    );
    queueMicrotask(() => setProgress(next));
  }, []);

  return (
    <main className="mx-auto min-h-[calc(100vh-4rem)] max-w-[1320px] px-4 py-8 sm:px-6 lg:px-10 lg:py-12">
      <EvidenceLabHero />
      <ReadOnlyNotice />
      <section className="mt-12" aria-labelledby="evidence-projects">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-bold text-[var(--accent)]">
              CURATED PROJECTS
            </p>
            <h2
              id="evidence-projects"
              className="mt-2 text-2xl font-bold tracking-[-.04em]"
            >
              Choose an evidence question
            </h2>
          </div>
          <p className="max-w-md text-sm leading-6 text-[var(--ink-muted)]">
            Every project uses a fixed teaching sample and reviewed
            public-source routes. No personal or uploaded data are collected.
          </p>
        </div>
        <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {EVIDENCE_PROJECTS.map((project) => (
            <EvidenceProjectCard
              key={project.slug}
              project={project}
              progress={progress[project.slug]}
            />
          ))}
        </div>
      </section>
      <ResearchWorkflow />
    </main>
  );
}

export function EvidenceLabHero() {
  return (
    <section className="grid items-center gap-7 rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-6 py-8 shadow-[var(--shadow)] lg:grid-cols-12 lg:px-9 lg:py-10">
      <div className="lg:col-span-7">
        <p className="text-xs font-bold tracking-[.12em] text-[var(--accent)]">
          LEARNING &amp; RESEARCH
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-[-.055em] sm:text-5xl">
          Evidence Lab
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--ink-muted)]">
          Test how well economic theories are supported by curated real-world
          evidence through guided, reproducible research exercises.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Badge className="bg-[var(--accent-soft)] text-[var(--accent)]">
            <Database size={12} />
            Curated datasets
          </Badge>
          <Badge>
            <BookOpenCheck size={12} />
            Guided methods
          </Badge>
          <Badge>
            <LockKeyhole size={12} />
            No data upload
          </Badge>
        </div>
      </div>
      <div className="lg:col-span-5">
        <TheoryToEvidenceDiagram />
      </div>
    </section>
  );
}

function TheoryToEvidenceDiagram() {
  const nodes = ["Theory", "Data", "Method", "Evidence", "Limitations"];
  return (
    <div className="rounded-xl bg-[var(--surface-subtle)] p-5">
      <p className="text-xs font-bold text-[var(--ink-muted)]">
        A transparent research path
      </p>
      <div className="mt-5 flex items-center gap-1.5 overflow-x-auto pb-1">
        {nodes.map((node, index) => (
          <div key={node} className="flex shrink-0 items-center gap-1.5">
            <span
              className={`rounded-lg border px-3 py-2 text-xs font-bold ${index === 3 ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]" : "border-[var(--line)] bg-[var(--surface)]"}`}
            >
              {node}
            </span>
            {index < nodes.length - 1 && (
              <ArrowRight
                size={14}
                className="text-[var(--accent)]"
                aria-hidden
              />
            )}
          </div>
        ))}
      </div>
      <p className="mt-4 text-xs leading-5 text-[var(--ink-muted)]">
        Evidence is interpreted alongside its design limits—not as an automatic
        causal conclusion.
      </p>
    </div>
  );
}

export function ReadOnlyNotice() {
  const [open, setOpen] = useState(false);
  return (
    <section className="mt-5 rounded-xl border border-[var(--line)] bg-[var(--surface-subtle)] px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <LockKeyhole size={15} className="text-[var(--ink-muted)]" />
          <p className="text-xs">
            <strong>Curated evidence only.</strong>{" "}
            <span className="text-[var(--ink-muted)]">
              Data upload is not available in this release. All projects use
              fixed teaching samples and reviewed public sources.
            </span>
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="inline-flex items-center gap-1 text-xs font-bold text-[var(--accent)]"
          aria-expanded={open}
        >
          {open ? "Hide" : "Why?"}
          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>
      {open && (
        <ul className="mt-3 grid gap-1 border-t border-[var(--line)] pt-3 text-xs leading-5 text-[var(--ink-muted)] sm:grid-cols-2">
          <li>• avoids collecting student research data</li>
          <li>• keeps calculations reproducible</li>
          <li>• lets all users work from the same evidence</li>
          <li>• separates teaching samples from population-level evidence</li>
        </ul>
      )}
    </section>
  );
}

export function EvidenceProjectCard({
  project,
  progress,
}: {
  project: EvidenceProject;
  progress?: StoredProgress;
}) {
  const completed = progress?.completedSteps?.length ?? 0;
  return (
    <Card className="flex min-w-0 flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold tracking-[.12em] text-[var(--accent)]">
            {project.category.toUpperCase()}
          </p>
          <h3 className="mt-2 text-xl font-bold tracking-[-.035em]">
            {project.title}
          </h3>
        </div>
        <ProjectMotif project={project} />
      </div>
      <p className="mt-3 min-h-14 text-sm leading-6 text-[var(--ink-muted)]">
        {project.researchQuestion}
      </p>
      <div className="mt-4 flex flex-wrap gap-1.5">
        <Badge className="bg-[var(--accent-soft)] text-[var(--accent)]">
          {project.topic}
        </Badge>
        <Badge>{project.duration}</Badge>
        <Badge>{project.evidenceStatus}</Badge>
      </div>
      <dl className="mt-4 space-y-2 border-y border-[var(--line)] py-4 text-xs">
        <div className="grid grid-cols-[72px_1fr] gap-2">
          <dt className="font-bold text-[var(--ink-faint)]">Method</dt>
          <dd>{project.methods.slice(0, 2).join(" + ")}</dd>
        </div>
        <div className="grid grid-cols-[72px_1fr] gap-2">
          <dt className="font-bold text-[var(--ink-faint)]">Dataset</dt>
          <dd className="text-[var(--ink-muted)]">{project.sampleStatus}</dd>
        </div>
        <div className="grid grid-cols-[72px_1fr] gap-2">
          <dt className="font-bold text-[var(--ink-faint)]">Models</dt>
          <dd className="text-[var(--ink-muted)]">
            {project.relatedModels.map((model) => model.label).join(" · ")}
          </dd>
        </div>
      </dl>
      <div className="mt-5 flex items-center justify-between gap-3">
        <p className="text-[10px] font-bold text-[var(--ink-muted)]">
          {progress?.complete
            ? "Completed"
            : completed
              ? `${completed} of 6 sections saved`
              : "Not started"}
        </p>
        <div className="flex gap-2">
          <Link
            href={`/research/${project.slug}?step=data#sources`}
            className="text-xs font-bold text-[var(--accent)]"
          >
            Sources
          </Link>
          <Link href={`/research/${project.slug}`}>
            <Button size="sm">
              {completed ? "Continue" : "Open Project"}
              <ArrowRight size={13} />
            </Button>
          </Link>
        </div>
      </div>
    </Card>
  );
}

function ProjectMotif({ project }: { project: EvidenceProject }) {
  const common =
    "h-20 w-28 shrink-0 rounded-lg border border-[var(--line)] bg-[var(--surface-subtle)]";
  if (project.slug === "flexible-work-wellbeing")
    return (
      <svg
        className={common}
        viewBox="0 0 112 80"
        role="img"
        aria-label="Worker wellbeing trajectories"
      >
        <path
          d="M12 61H102M16 52L36 45 55 30 76 33 96 18M16 64L36 61 55 49 76 42 96 35M16 30L36 27 55 23 76 19 96 15"
          fill="none"
          stroke="var(--accent)"
          strokeWidth="2"
        />
        <circle cx="55" cy="30" r="2.5" fill="var(--accent)" />
        <path d="M12 16V64" stroke="var(--line-strong)" />
      </svg>
    );
  if (project.slug === "restaurant-demand-food-waste")
    return (
      <svg
        className={common}
        viewBox="0 0 112 80"
        role="img"
        aria-label="Demand and inventory comparison"
      >
        <path
          d="M12 62H102M18 52L34 35 50 44 66 19 82 31 98 22"
          fill="none"
          stroke="var(--accent)"
          strokeWidth="2"
        />
        <path
          d="M18 57L34 40 50 48 66 26 82 36 98 29"
          fill="none"
          stroke="var(--amber)"
          strokeWidth="2"
          strokeDasharray="4 3"
        />
        <rect x="70" y="47" width="10" height="15" fill="var(--red-soft)" />
        <rect x="86" y="54" width="10" height="8" fill="var(--red-soft)" />
      </svg>
    );
  return (
    <svg
      className={common}
      viewBox="0 0 112 80"
      role="img"
      aria-label="Oil prices and inflation time series"
    >
      <path
        d="M12 62H102M16 52L31 48 46 35 61 19 76 14 91 22 100 24"
        fill="none"
        stroke="var(--amber)"
        strokeWidth="2"
      />
      <path
        d="M16 59L31 56 46 50 61 38 76 32 91 27 100 24"
        fill="none"
        stroke="var(--accent)"
        strokeWidth="2"
      />
      <path d="M12 16V62" stroke="var(--line-strong)" />
    </svg>
  );
}

export function ResearchWorkflow() {
  const descriptions = [
    "Define the economic question and proposed relationship.",
    "Review theory and its predicted mechanism.",
    "Understand variables, units, sample and limitations.",
    "See why a specific empirical method is used.",
    "Interpret charts, coefficients and uncertainty.",
    "Separate association, model support and causal evidence.",
  ];
  const icons = [
    SearchCheck,
    Network,
    Database,
    FlaskConical,
    BarChart3,
    BookOpenCheck,
  ];
  return (
    <section className="mt-14 border-t border-[var(--line)] pt-10">
      <div>
        <p className="text-xs font-bold text-[var(--accent)]">
          RESEARCH WORKFLOW
        </p>
        <h2 className="mt-2 text-2xl font-bold tracking-[-.04em]">
          How an Evidence Lab works
        </h2>
      </div>
      <ol className="mt-7 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        {EVIDENCE_STEPS.map((step, index) => {
          const Icon = icons[index];
          return (
            <li
              key={step.id}
              className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4"
            >
              <span className="text-[10px] font-bold text-[var(--accent)]">
                0{index + 1}
              </span>
              <p className="mt-2 flex items-center gap-2 text-sm font-bold">
                <Icon size={15} className="text-[var(--accent)]" />
                {step.short}
              </p>
              <p className="mt-2 text-xs leading-5 text-[var(--ink-muted)]">
                {descriptions[index]}
              </p>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
