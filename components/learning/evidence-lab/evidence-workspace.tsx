"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  ExternalLink,
  FlaskConical,
  Lightbulb,
  ListChecks,
  LockKeyhole,
  Printer,
  RotateCcw,
  SearchCheck,
  SlidersHorizontal,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  EvidenceResults,
  UnavailableChart,
} from "@/components/learning/evidence-lab/evidence-charts";
import {
  EVIDENCE_STEPS,
  displayValue,
  evidenceProjectStorageKey,
  type EvidenceProject,
  type EvidenceStepId,
} from "@/lib/evidence-lab/projects";

type SavedState = {
  completedSteps: EvidenceStepId[];
  prediction?: "positive" | "negative" | "unclear";
  complete?: boolean;
  controls?: MethodControls;
};
type MethodControls = {
  ols: boolean;
  fixedEffects: boolean;
  workload: boolean;
  monthEffects: boolean;
  standardise: boolean;
};
const defaultControls: MethodControls = {
  ols: true,
  fixedEffects: true,
  workload: true,
  monthEffects: true,
  standardise: false,
};
const validSteps = new Set<string>(EVIDENCE_STEPS.map((step) => step.id));

export function EvidenceProjectWorkspace({
  project,
}: {
  project: EvidenceProject;
}) {
  const [step, setStep] = useState<EvidenceStepId>("question");
  const [saved, setSaved] = useState<SavedState>({
    completedSteps: [],
    controls: defaultControls,
  });
  const [hydrated, setHydrated] = useState(false);
  const controls = saved.controls ?? defaultControls;
  const completeCount = saved.completedSteps.length;

  useEffect(() => {
    const query = new URLSearchParams(window.location.search).get("step");
    let restored: SavedState = {
      completedSteps: [],
      controls: defaultControls,
    };
    try {
      restored = {
        ...restored,
        ...JSON.parse(
          window.localStorage.getItem(evidenceProjectStorageKey(project)) ??
            "{}",
        ),
      };
    } catch {
      window.localStorage.removeItem(evidenceProjectStorageKey(project));
    }
    queueMicrotask(() => {
      if (query && validSteps.has(query)) setStep(query as EvidenceStepId);
      setSaved(restored);
      setHydrated(true);
    });
  }, [project]);

  useEffect(() => {
    if (hydrated)
      window.localStorage.setItem(
        evidenceProjectStorageKey(project),
        JSON.stringify(saved),
      );
  }, [hydrated, project, saved]);
  const go = useCallback((next: EvidenceStepId) => {
    setStep(next);
    const url = new URL(window.location.href);
    url.searchParams.set("step", next);
    window.history.replaceState({}, "", url);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);
  const markStep = () =>
    setSaved((current) => ({
      ...current,
      completedSteps: current.completedSteps.includes(step)
        ? current.completedSteps
        : [...current.completedSteps, step],
    }));
  const reset = () => {
    setSaved({ completedSteps: [], controls: defaultControls });
    go("question");
  };
  const toggleComplete = () =>
    setSaved((current) => ({
      ...current,
      complete: !current.complete,
      completedSteps: current.complete
        ? current.completedSteps
        : EVIDENCE_STEPS.map((item) => item.id),
    }));
  const setPrediction = (prediction: SavedState["prediction"]) =>
    setSaved((current) => ({ ...current, prediction }));
  const setControls = (next: Partial<MethodControls>) =>
    setSaved((current) => ({ ...current, controls: { ...controls, ...next } }));
  const currentIndex = EVIDENCE_STEPS.findIndex((item) => item.id === step);

  return (
    <>
      <style>{`@media print{.evidence-print{max-width:none!important;padding:0!important}.evidence-print .evidence-at-a-glance{position:static!important}.evidence-print header,.evidence-print section,.evidence-print article,.evidence-print svg{break-inside:avoid}.evidence-print table thead{display:table-header-group}.evidence-print table{page-break-inside:auto}.evidence-print tr{break-inside:avoid}.evidence-print::after{display:block;content:"${project.title} · Page " counter(page);margin-top:12mm;border-top:1px solid #bbb;padding-top:4mm;font-size:10px;color:#555}@page{margin:14mm}}`}</style>
      <main className="evidence-print mx-auto min-h-[calc(100vh-4rem)] max-w-[1320px] px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
        <ProjectHeader
          project={project}
          completed={completeCount}
          complete={Boolean(saved.complete)}
          onReset={reset}
        />
        <div className="mt-6 grid gap-5 xl:grid-cols-[235px_minmax(0,1fr)_300px]">
          <ProjectStepNavigation
            step={step}
            completed={saved.completedSteps}
            onChange={go}
          />
          <section className="min-w-0">
            <StepContent
              project={project}
              step={step}
              prediction={saved.prediction}
              onPrediction={setPrediction}
              controls={controls}
              onControls={setControls}
            />
            <StepFooter
              currentIndex={currentIndex}
              marked={saved.completedSteps.includes(step)}
              onMark={markStep}
              onPrevious={() =>
                currentIndex > 0 && go(EVIDENCE_STEPS[currentIndex - 1].id)
              }
              onNext={() =>
                currentIndex < EVIDENCE_STEPS.length - 1 &&
                go(EVIDENCE_STEPS[currentIndex + 1].id)
              }
            />
          </section>
          <EvidenceAtAGlance project={project} />
        </div>
        {step === "limits" && (
          <ProjectConclusion
            project={project}
            complete={Boolean(saved.complete)}
            onComplete={toggleComplete}
            onMethod={() => go("method")}
          />
        )}
      </main>
    </>
  );
}

function ProjectHeader({
  project,
  completed,
  complete,
  onReset,
}: {
  project: EvidenceProject;
  completed: number;
  complete: boolean;
  onReset: () => void;
}) {
  return (
    <header className="border-b border-[var(--line)] pb-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/research"
          className="no-print inline-flex items-center gap-1 text-xs font-bold text-[var(--accent)]"
        >
          <ArrowLeft size={14} />
          Evidence Lab
        </Link>
        <div className="flex flex-wrap gap-2">
          <Badge>{project.category}</Badge>
          <Badge>{project.duration}</Badge>
          <Badge className="bg-[var(--surface-subtle)]">
            <LockKeyhole size={11} />
            Read-only
          </Badge>
          {complete && (
            <Badge className="bg-[var(--accent-soft)] text-[var(--accent)]">
              <CheckCircle2 size={11} />
              Completed
            </Badge>
          )}
        </div>
      </div>
      <p className="mt-5 text-[10px] font-bold tracking-[.12em] text-[var(--accent)]">
        {project.id} · CURATED TEACHING EXERCISE
      </p>
      <h1 className="mt-2 max-w-4xl text-3xl font-bold tracking-[-.05em] sm:text-4xl">
        {project.title}
      </h1>
      <p className="mt-3 max-w-4xl text-base leading-7 text-[var(--ink-muted)]">
        <strong className="text-[var(--ink)]">Research question:</strong>{" "}
        {project.researchQuestion}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {project.methods.map((method) => (
          <Badge
            key={method}
            className="bg-[var(--accent-soft)] text-[var(--accent)]"
          >
            {method}
          </Badge>
        ))}
        <Badge>{project.evidenceStatus}</Badge>
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-[220px] flex-1">
          <div className="flex justify-between text-xs">
            <span className="font-bold">
              {completed} of 6 sections completed
            </span>
            <span className="text-[var(--ink-muted)]">
              Saved on this device
            </span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--surface-strong)]">
            <div
              className="h-full rounded-full bg-[var(--accent)] transition-all"
              style={{ width: `${(completed / 6) * 100}%` }}
            />
          </div>
        </div>
        <Button
          className="no-print"
          size="sm"
          variant="ghost"
          onClick={onReset}
        >
          <RotateCcw size={13} />
          Reset progress
        </Button>
      </div>
    </header>
  );
}

function ProjectStepNavigation({
  step,
  completed,
  onChange,
}: {
  step: EvidenceStepId;
  completed: EvidenceStepId[];
  onChange: (step: EvidenceStepId) => void;
}) {
  return (
    <nav
      className="no-print xl:sticky xl:top-20 xl:self-start"
      aria-label="Research project sections"
    >
      <div className="overflow-x-auto rounded-xl border border-[var(--line)] bg-[var(--surface)] p-2 xl:overflow-visible">
        <p className="hidden px-2 pb-2 pt-1 text-[10px] font-bold tracking-[.12em] text-[var(--ink-faint)] xl:block">
          PROJECT SECTIONS
        </p>
        <div className="flex gap-1 xl:block xl:space-y-1">
          {EVIDENCE_STEPS.map((item, index) => {
            const active = step === item.id;
            const done = completed.includes(item.id);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onChange(item.id)}
                className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2.5 text-left text-xs font-bold transition-colors xl:w-full ${active ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "text-[var(--ink-muted)] hover:bg-[var(--surface-subtle)]"}`}
                aria-current={active ? "step" : undefined}
              >
                <span
                  className={`grid h-5 w-5 place-items-center rounded-full text-[10px] ${done ? "bg-[var(--accent)] text-white" : "bg-[var(--surface-strong)]"}`}
                >
                  {done ? <CheckCircle2 size={12} /> : index + 1}
                </span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

function EvidenceAtAGlance({ project }: { project: EvidenceProject }) {
  const outcome = project.variables.find((item) => item.role === "Outcome");
  const explanatory = project.variables.find(
    (item) => item.role === "Explanatory",
  );
  const control = project.variables.find((item) => item.role === "Control");
  const observationCount = project.datasetSummary.find(
    (item) => item.label.includes("rows") || item.label.includes("records"),
  );
  return (
    <aside className="evidence-at-a-glance xl:sticky xl:top-20 xl:self-start">
      <Card className="p-4">
        <p className="text-[10px] font-bold tracking-[.12em] text-[var(--accent)]">
          EVIDENCE AT A GLANCE
        </p>
        <dl className="mt-4 space-y-3 text-xs">
          <Summary
            label="Research design"
            value={project.methods.join(" · ")}
          />
          <Summary
            label="Unit of analysis"
            value={
              observationCount
                ? `${observationCount.value} teaching observations`
                : project.sampleStatus
            }
          />
          <Summary
            label="Main outcome"
            value={
              outcome
                ? `${outcome.meaning} (${outcome.unit})`
                : "Not separately identified"
            }
          />
          <Summary
            label="Main explanatory variable"
            value={
              explanatory ? explanatory.meaning : "Not separately identified"
            }
          />
          <Summary
            label="Key control"
            value={control ? control.meaning : "Not supplied"}
          />
          <Summary
            label="Expected teaching result"
            value={project.expectedResult}
          />
          <Summary
            label="Causal confidence"
            value={project.causalConfidence}
            tone="accent"
          />
          <Summary
            label="Main limitation"
            value={project.limitations[0]?.text ?? project.evidenceStatus}
            tone="red"
          />
        </dl>
      </Card>
    </aside>
  );
}

function Summary({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "accent" | "red";
}) {
  return (
    <div className="border-b border-[var(--line)] pb-3 last:border-0 last:pb-0">
      <dt className="text-[10px] font-bold uppercase tracking-wide text-[var(--ink-faint)]">
        {label}
      </dt>
      <dd
        className={`mt-1 leading-5 ${tone === "accent" ? "font-bold text-[var(--accent)]" : tone === "red" ? "text-[var(--red)]" : "text-[var(--ink-muted)]"}`}
      >
        {value}
      </dd>
    </div>
  );
}

function StepContent({
  project,
  step,
  prediction,
  onPrediction,
  controls,
  onControls,
}: {
  project: EvidenceProject;
  step: EvidenceStepId;
  prediction: SavedState["prediction"];
  onPrediction: (value: SavedState["prediction"]) => void;
  controls: MethodControls;
  onControls: (value: Partial<MethodControls>) => void;
}) {
  const sections: Record<EvidenceStepId, React.ReactNode> = {
    question: (
      <ResearchQuestionPanel
        project={project}
        prediction={prediction}
        onPrediction={onPrediction}
      />
    ),
    theory: <TheoryPanel project={project} />,
    data: <DataPanel project={project} />,
    method: (
      <MethodPanel
        project={project}
        controls={controls}
        onControls={onControls}
      />
    ),
    results: <ResultsPanel project={project} controls={controls} />,
    limits: <CausalLimitsPanel project={project} />,
  };
  return (
    <article className="evidence-step rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[var(--shadow)] sm:p-7">
      {sections[step]}
    </article>
  );
}

function StepHeading({
  number,
  title,
  text,
}: {
  number: string;
  title: string;
  text: string;
}) {
  return (
    <div className="border-b border-[var(--line)] pb-5">
      <p className="text-[10px] font-bold tracking-[.12em] text-[var(--accent)]">
        SECTION {number}
      </p>
      <h2 className="mt-2 text-2xl font-bold tracking-[-.04em]">{title}</h2>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--ink-muted)]">
        {text}
      </p>
    </div>
  );
}

function ResearchQuestionPanel({
  project,
  prediction,
  onPrediction,
}: {
  project: EvidenceProject;
  prediction: SavedState["prediction"];
  onPrediction: (value: SavedState["prediction"]) => void;
}) {
  return (
    <>
      <StepHeading
        number="01"
        title="Research Question"
        text="Set the claim before inspecting the fixed teaching sample."
      />
      <section className="mt-6 grid gap-5 lg:grid-cols-[1.1fr_.9fr]">
        <div>
          <p className="text-sm font-bold">{project.researchQuestion}</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <InfoPanel
              title="Hypothesis"
              text={project.hypothesis}
              icon={<Lightbulb size={16} />}
            />
            <InfoPanel
              title="Economic actors"
              text={project.actors.join(" · ")}
              icon={<SearchCheck size={16} />}
            />
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <InfoPanel
              title="Evidence that supports it"
              text={project.evidenceSupport}
            />
            <InfoPanel
              title="Evidence that weakens it"
              text={project.evidenceWeakens}
            />
          </div>
        </div>
        <CausalDiagram project={project} compact />
      </section>
      <section className="mt-6 rounded-xl bg-[var(--surface-subtle)] p-5">
        <p className="text-sm font-bold">Before viewing the data</p>
        <p className="mt-1 text-xs leading-5 text-[var(--ink-muted)]">
          Choose a prediction. It is saved locally, never graded and can be
          changed later.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {(
            [
              ["positive", "Positive association"],
              ["negative", "Negative association"],
              ["unclear", "No clear association"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => onPrediction(value)}
              className={`rounded-lg border px-3 py-2 text-xs font-bold ${prediction === value ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]" : "border-[var(--line)] bg-[var(--surface)] text-[var(--ink-muted)]"}`}
            >
              {label}
            </button>
          ))}
        </div>
        {prediction && (
          <p className="mt-3 text-xs text-[var(--accent)]">
            Saved prediction:{" "}
            {prediction === "positive"
              ? "positive association"
              : prediction === "negative"
                ? "negative association"
                : "no clear association"}
            .
          </p>
        )}
      </section>
    </>
  );
}

function InfoPanel({
  title,
  text,
  icon,
}: {
  title: string;
  text: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-[var(--line)] p-4">
      <p className="flex items-center gap-2 text-xs font-bold">
        {icon}
        {title}
      </p>
      <p className="mt-2 text-xs leading-5 text-[var(--ink-muted)]">{text}</p>
    </div>
  );
}

function TheoryPanel({ project }: { project: EvidenceProject }) {
  return (
    <>
      <StepHeading
        number="02"
        title="Theory"
        text="Use the model to identify mechanisms and possible confounding—not to assume the answer."
      />
      <section className="mt-6">
        <CausalDiagram project={project} />
      </section>
      <section className="mt-6 grid gap-4 md:grid-cols-2">
        <InfoPanel
          title="What the theory predicts"
          text={project.theoryPredicts}
          icon={<Lightbulb size={16} />}
        />
        <InfoPanel
          title="What the theory does not prove"
          text={project.theoryDoesNotProve}
          icon={<CircleAlert size={16} />}
        />
      </section>
      <section className="mt-6">
        <p className="text-xs font-bold text-[var(--ink-faint)]">
          LINKED MODELS
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {project.relatedModels.map((model) => (
            <Link
              key={model.label}
              href={model.href}
              className="rounded-lg border border-[var(--line)] px-3 py-2 text-xs font-bold text-[var(--accent)] hover:bg-[var(--accent-soft)]"
            >
              {model.label}
              <ArrowRight className="ml-1 inline" size={12} />
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}

function CausalDiagram({
  project,
  compact = false,
}: {
  project: EvidenceProject;
  compact?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border border-[var(--line)] bg-[var(--surface-subtle)] ${compact ? "p-4" : "p-5"}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold">Mechanism and confounding map</p>
          <p className="mt-1 text-xs text-[var(--ink-muted)]">
            Solid links are measured or direct teaching relationships; dotted
            links are possible confounding pathways.
          </p>
        </div>
        <div className="flex gap-2 text-[10px] text-[var(--ink-muted)]">
          <span>— measured/direct</span>
          <span className="border-t border-dashed border-[var(--ink-muted)]">
            {" "}
            possible confounding
          </span>
        </div>
      </div>
      <div
        className={`mt-5 grid gap-2 ${compact ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-4"}`}
      >
        {project.theoryNodes.map((node) => (
          <div
            key={node.id}
            className={`relative rounded-lg border p-3 text-center text-xs font-bold ${node.measured ? "border-[var(--accent)] bg-[var(--surface)] text-[var(--accent)]" : "border-[var(--line)] bg-[var(--surface)]"}`}
          >
            <span>{node.label}</span>
            <span className="absolute -right-2 top-1/2 hidden text-[var(--accent)] sm:block">
              →
            </span>
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-2 text-[10px] text-[var(--ink-muted)]">
        {project.theoryLinks.map((link) => (
          <span
            key={`${link.from}-${link.to}`}
            className={`rounded border px-2 py-1 ${link.dotted ? "border-dashed" : "border-[var(--line)]"}`}
          >
            {project.theoryNodes.find((item) => item.id === link.from)?.label} →{" "}
            {project.theoryNodes.find((item) => item.id === link.to)?.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function DataPanel({ project }: { project: EvidenceProject }) {
  return (
    <>
      <StepHeading
        number="03"
        title="Data"
        text="Inspect the fixed educational sample, distinguish it from public evidence routes and check how variables are defined."
      />
      <section className="mt-6 grid gap-3 grid-cols-2 lg:grid-cols-4">
        {project.datasetSummary.map((item) => (
          <div
            key={item.label}
            className="rounded-xl bg-[var(--surface-subtle)] p-4"
          >
            <p className="text-xl font-bold text-[var(--accent)]">
              {item.value}
            </p>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-[var(--ink-muted)]">
              {item.label}
            </p>
          </div>
        ))}
      </section>
      <section className="mt-5 rounded-xl border border-[var(--amber)] bg-[var(--amber-soft)] p-4">
        <p className="flex items-center gap-2 text-xs font-bold">
          <FlaskConical size={15} />
          {project.sampleStatus}
        </p>
        <p className="mt-2 text-xs leading-5 text-[var(--ink-muted)]">
          {project.sampleReason}
        </p>
      </section>
      <DataDictionary project={project} />
      <DataPreviewTable project={project} />
      <SourceDrawer project={project} />
      <CleaningPipeline project={project} />
    </>
  );
}

function DataDictionary({ project }: { project: EvidenceProject }) {
  return (
    <section className="mt-7">
      <p className="text-xs font-bold text-[var(--ink-faint)]">
        DATA DICTIONARY
      </p>
      <div className="mt-3 overflow-x-auto rounded-xl border border-[var(--line)]">
        <table className="w-full min-w-[680px] text-left text-xs">
          <thead className="bg-[var(--surface-subtle)] text-[10px] uppercase tracking-wide text-[var(--ink-faint)]">
            <tr>
              <th className="px-3 py-3">Variable</th>
              <th className="px-3 py-3">Meaning</th>
              <th className="px-3 py-3">Unit</th>
              <th className="px-3 py-3">Role</th>
              <th className="px-3 py-3">Example value</th>
            </tr>
          </thead>
          <tbody>
            {project.variables.map((item) => (
              <tr key={item.name} className="border-t border-[var(--line)]">
                <td className="px-3 py-3 font-bold">{item.name}</td>
                <td className="px-3 py-3 text-[var(--ink-muted)]">
                  {item.meaning}
                </td>
                <td className="px-3 py-3 text-[var(--ink-muted)]">
                  {item.unit}
                </td>
                <td className="px-3 py-3">
                  <RoleTag role={item.role} />
                </td>
                <td className="px-3 py-3 font-mono text-[var(--ink-muted)]">
                  {item.example}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function RoleTag({ role }: { role: string }) {
  const tone =
    role === "Outcome"
      ? "bg-[var(--accent-soft)] text-[var(--accent)]"
      : role === "Control"
        ? "bg-[var(--blue-soft)] text-[var(--blue)]"
        : role === "Explanatory"
          ? "bg-[var(--amber-soft)] text-[var(--amber)]"
          : "";
  return <Badge className={tone}>{role}</Badge>;
}

function DataPreviewTable({ project }: { project: EvidenceProject }) {
  const [sort, setSort] = useState("none");
  const [filter, setFilter] = useState("all");
  const [highlight, setHighlight] = useState("all");
  const columns = [
    ...new Set(
      project.sampleRows.flatMap((row) =>
        Object.keys(row).filter((key) => key !== "status"),
      ),
    ),
  ];
  const timeColumn = project.variables.find(
    (item) => item.role === "Time",
  )?.name;
  const idColumn = project.variables.find((item) => item.role === "ID")?.name;
  const rows = [...project.sampleRows]
    .filter(
      (row) => filter === "all" || String(row[timeColumn ?? ""]) === filter,
    )
    .sort((left, right) =>
      sort === "none"
        ? 0
        : String(left[sort]).localeCompare(String(right[sort]), undefined, {
            numeric: true,
          }),
    );
  return (
    <section className="mt-7">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold text-[var(--ink-faint)]">
            FIXED SAMPLE PREVIEW
          </p>
          <p className="mt-1 text-xs text-[var(--ink-muted)]">
            This preview is a fixed educational sample. It cannot be edited or
            uploaded.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="text-[10px] font-bold text-[var(--ink-muted)]">
            Sort{" "}
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value)}
              className="ml-1 rounded border border-[var(--line)] bg-[var(--surface)] px-2 py-1 text-xs"
            >
              {["none", ...columns].map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          {timeColumn && (
            <label className="text-[10px] font-bold text-[var(--ink-muted)]">
              Filter{" "}
              <select
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
                className="ml-1 rounded border border-[var(--line)] bg-[var(--surface)] px-2 py-1 text-xs"
              >
                <option value="all">all periods</option>
                {[
                  ...new Set(
                    project.sampleRows.map((row) => String(row[timeColumn])),
                  ),
                ].map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </label>
          )}
          {idColumn && (
            <label className="text-[10px] font-bold text-[var(--ink-muted)]">
              Highlight{" "}
              <select
                value={highlight}
                onChange={(event) => setHighlight(event.target.value)}
                className="ml-1 rounded border border-[var(--line)] bg-[var(--surface)] px-2 py-1 text-xs"
              >
                <option value="all">all workers</option>
                {[
                  ...new Set(
                    project.sampleRows.map((row) => String(row[idColumn])),
                  ),
                ].map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </label>
          )}
        </div>
      </div>
      <div className="mt-3 overflow-x-auto rounded-xl border border-[var(--line)]">
        <table className="w-full min-w-[760px] text-left text-xs">
          <thead className="bg-[var(--surface-subtle)] text-[10px] uppercase tracking-wide text-[var(--ink-faint)]">
            <tr>
              {columns.map((column) => (
                <th key={column} className="px-3 py-3">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 10).map((row, index) => (
              <tr
                key={`${index}-${String(row[columns[0]])}`}
                className={`border-t border-[var(--line)] ${idColumn && highlight !== "all" && row[idColumn] === highlight ? "bg-[var(--accent-soft)]" : ""}`}
              >
                {columns.map((column) => (
                  <td key={column} className="px-3 py-2.5">
                    {displayValue(row[column])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function SourceDrawer({ project }: { project: EvidenceProject }) {
  return (
    <details
      id="sources"
      className="mt-7 rounded-xl border border-[var(--line)]"
    >
      <summary className="cursor-pointer list-none px-4 py-4 text-sm font-bold">
        <span className="flex items-center justify-between">
          Sources and sample boundary <ChevronDown size={16} />
        </span>
      </summary>
      <div className="border-t border-[var(--line)] p-4">
        <p className="text-xs leading-5 text-[var(--ink-muted)]">
          Public source routes supply context and reproducible access paths. The
          teaching sample is separate and must not be presented as a direct
          extract of these sources.
        </p>
        <div className="mt-4 grid gap-3">
          {project.sources.map((item) => (
            <div
              key={item.label}
              className="rounded-lg bg-[var(--surface-subtle)] p-4"
            >
              <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--ink-faint)]">
                {item.label}
              </p>
              <p className="mt-1 text-sm font-bold">{item.publisher}</p>
              <p className="mt-2 text-xs leading-5 text-[var(--ink-muted)]">
                {item.coverage}
              </p>
              <p className="mt-2 text-[10px] text-[var(--ink-faint)]">
                {item.licence}
                {item.accessed ? ` · Accessed ${item.accessed}` : ""}
              </p>
              {item.url && (
                <a
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-[var(--accent)]"
                >
                  Open source <ExternalLink size={12} />
                </a>
              )}
            </div>
          ))}
        </div>
      </div>
    </details>
  );
}

function CleaningPipeline({ project }: { project: EvidenceProject }) {
  const [open, setOpen] = useState<string | null>(
    project.cleaningSteps[0]?.stage ?? null,
  );
  return (
    <section className="mt-7">
      <p className="text-xs font-bold text-[var(--ink-faint)]">
        CLEANING AND PREPARATION
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-4">
        {project.cleaningSteps.map((item, index) => (
          <button
            type="button"
            key={item.stage}
            onClick={() =>
              setOpen((value) => (value === item.stage ? null : item.stage))
            }
            className={`rounded-xl border p-3 text-left ${open === item.stage ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-[var(--line)]"}`}
          >
            <span className="text-[10px] font-bold text-[var(--accent)]">
              0{index + 1}
            </span>
            <p className="mt-1 text-xs font-bold">{item.stage}</p>
            {open === item.stage && (
              <p className="mt-2 text-xs leading-5 text-[var(--ink-muted)]">
                {item.detail}
              </p>
            )}
          </button>
        ))}
      </div>
      <p className="mt-3 text-xs text-[var(--red)]">
        Cleaning alone never creates causal assignment.
      </p>
    </section>
  );
}

function MethodPanel({
  project,
  controls,
  onControls,
}: {
  project: EvidenceProject;
  controls: MethodControls;
  onControls: (next: Partial<MethodControls>) => void;
}) {
  return (
    <>
      <StepHeading
        number="04"
        title="Method"
        text="Compare a transparent cross-observation association with a within-unit change design."
      />
      <section className="mt-6 grid gap-4 lg:grid-cols-2">
        {project.equations.map((equation, index) => (
          <EquationCard
            key={equation.label}
            equation={equation}
            active={index === 0 ? controls.ols : controls.fixedEffects}
            onToggle={() =>
              onControls(
                index === 0
                  ? { ols: !controls.ols }
                  : { fixedEffects: !controls.fixedEffects },
              )
            }
          />
        ))}
      </section>
      <section className="mt-6 rounded-xl bg-[var(--surface-subtle)] p-5">
        <div className="flex items-center gap-2">
          <SlidersHorizontal size={16} className="text-[var(--accent)]" />
          <h3 className="text-sm font-bold">Teaching controls</h3>
        </div>
        <p className="mt-1 text-xs leading-5 text-[var(--ink-muted)]">
          These switches only update the curated result display. They do not
          create unrestricted econometric software.
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {(
            [
              [
                "ols",
                "Show OLS",
                "Across observations after the displayed controls.",
              ],
              [
                "fixedEffects",
                "Show Fixed Effects",
                "Within-unit changes where the design supports it.",
              ],
              [
                "workload",
                "Include workload control",
                "Shows the supplied control in the teaching comparison.",
              ],
              [
                "monthEffects",
                "Include month effects",
                "Shows common period effects in the displayed Fixed Effects form.",
              ],
              [
                "standardise",
                "Standardise variables",
                "Rescales the displayed coefficient only; it does not alter the sample.",
              ],
            ] as const
          ).map(([key, label, detail]) => (
            <label
              key={key}
              className="flex cursor-pointer items-start gap-3 rounded-lg border border-[var(--line)] bg-[var(--surface)] p-3"
            >
              <input
                type="checkbox"
                checked={controls[key]}
                onChange={(event) =>
                  onControls({ [key]: event.target.checked })
                }
                className="mt-0.5 accent-[var(--accent)]"
              />
              <span>
                <span className="block text-xs font-bold">{label}</span>
                <span className="mt-1 block text-[10px] leading-4 text-[var(--ink-muted)]">
                  {detail}
                </span>
              </span>
            </label>
          ))}
        </div>
      </section>
      <section className="mt-6 grid gap-4 sm:grid-cols-2">
        <InfoPanel
          title="OLS: unit A versus unit B"
          text="The first method compares differences across observations and over time. Stable characteristics can remain omitted."
        />
        <InfoPanel
          title="Fixed Effects: unit A now versus earlier"
          text="The second method focuses on change within the same unit and can include common period effects where the project supports it."
        />
      </section>
    </>
  );
}

function EquationCard({
  equation,
  active,
  onToggle,
}: {
  equation: EvidenceProject["equations"][number];
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <Card className={`p-5 ${active ? "border-[var(--accent)]" : ""}`}>
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-bold">{equation.label}</h3>
        <button
          type="button"
          onClick={onToggle}
          className={`rounded-md px-2 py-1 text-[10px] font-bold ${active ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "bg-[var(--surface-subtle)] text-[var(--ink-muted)]"}`}
        >
          {active ? "Shown" : "Hidden"}
        </button>
      </div>
      <p className="mt-3 text-xs leading-5 text-[var(--ink-muted)]">
        {equation.question}
      </p>
      <div
        className="mt-4 overflow-x-auto rounded-lg bg-[var(--surface-subtle)] px-4 py-5 text-center font-serif text-base leading-7"
        aria-label={equation.plain}
      >
        {equation.expression}
      </div>
      <div className="mt-4 grid gap-3 text-xs sm:grid-cols-2">
        <div>
          <p className="font-bold">What it compares</p>
          <p className="mt-1 leading-5 text-[var(--ink-muted)]">
            {equation.label === "OLS"
              ? "Differences across observations and over time."
              : "Within-unit change over time."}
          </p>
        </div>
        <div>
          <p className="font-bold">Main risk</p>
          <p className="mt-1 leading-5 text-[var(--ink-muted)]">
            {equation.risk}
          </p>
        </div>
      </div>
    </Card>
  );
}

function ResultsPanel({
  project,
  controls,
}: {
  project: EvidenceProject;
  controls: MethodControls;
}) {
  return (
    <>
      <StepHeading
        number="05"
        title="Results"
        text="Read the teaching calculation first, then keep its evidence boundary in view."
      />
      <section className="mt-6 rounded-xl border border-[var(--accent)] bg-[var(--accent-soft)] p-5">
        <p className="text-xs font-bold text-[var(--accent)]">
          TEACHING RESULT
        </p>
        <p className="mt-2 text-base font-semibold leading-7">
          {project.expectedResult}
        </p>
        <p className="mt-3 text-xs leading-5 text-[var(--ink-muted)]">
          All visualisations below are generated from the project’s fixed
          teaching sample. Tooltips are available by hovering or focusing
          plotted points.
        </p>
      </section>
      <section className="mt-6">
        <EvidenceResults
          project={project}
          includeWorkload={controls.workload}
          includeMonth={controls.monthEffects}
          standardise={controls.standardise}
        />
      </section>
      <section className="mt-6 grid gap-4 md:grid-cols-2">
        <InfoPanel
          title="What the calculation shows"
          text={project.interpretation.shows
            .map((item) => `• ${item}`)
            .join("\n")}
          icon={<CheckCircle2 size={16} />}
        />
        <InfoPanel
          title="What it does not show"
          text={project.interpretation.doesNotShow
            .map((item) => `• ${item}`)
            .join("\n")}
          icon={<CircleAlert size={16} />}
        />
      </section>
      {project.slug === "oil-prices-inflation" && (
        <div className="mt-6">
          <UnavailableChart
            title="Headline versus core inflation"
            detail="The fixed teaching series contains headline inflation only. Core inflation is intentionally not inferred or fabricated."
          />
        </div>
      )}
    </>
  );
}

function CausalLimitsPanel({ project }: { project: EvidenceProject }) {
  const levels = [
    "Descriptive pattern",
    "Conditional association",
    "Within-person association",
    "Quasi-causal evidence",
    "Credible causal estimate",
  ];
  const justified =
    project.slug === "flexible-work-wellbeing"
      ? 2
      : project.slug === "restaurant-demand-food-waste"
        ? 0
        : 1;
  return (
    <>
      <StepHeading
        number="06"
        title="Causal Limits"
        text="Judge the strength of the claim separately from whether a result is interesting or theory-consistent."
      />
      <section className="mt-6">
        <p className="text-xs font-bold text-[var(--ink-faint)]">
          CAUSAL CLAIM LADDER
        </p>
        <ol className="mt-3 grid gap-2 sm:grid-cols-5">
          {levels.map((level, index) => (
            <li
              key={level}
              className={`rounded-xl border p-3 ${index === justified ? "border-[var(--accent)] bg-[var(--accent-soft)]" : index < justified ? "border-[var(--line)] bg-[var(--surface-subtle)]" : "border-[var(--line)]"}`}
            >
              <p className="text-[10px] font-bold text-[var(--ink-faint)]">
                LEVEL {index + 1}
              </p>
              <p
                className={`mt-1 text-xs font-bold ${index === justified ? "text-[var(--accent)]" : ""}`}
              >
                {level}
              </p>
              {index === justified && (
                <p className="mt-2 text-[10px] text-[var(--accent)]">
                  Highest justified here
                </p>
              )}
            </li>
          ))}
        </ol>
        <p className="mt-4 text-xs leading-5 text-[var(--ink-muted)]">
          {project.causalConfidence === "Association"
            ? "The displayed result is not causal proof. It may be a within-person association where the panel design permits that reading."
            : "The displayed result is operational teaching evidence, not a causal evaluation of an intervention."}
        </p>
      </section>
      <section className="mt-7">
        <p className="text-xs font-bold text-[var(--ink-faint)]">
          UNRESOLVED THREATS
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {project.limitations.map((item) => (
            <InfoPanel
              key={item.title}
              title={item.title}
              text={item.text}
              icon={<CircleAlert size={15} />}
            />
          ))}
        </div>
      </section>
      <section className="mt-7 rounded-xl bg-[var(--surface-subtle)] p-5">
        <p className="text-sm font-bold">
          What stronger evidence would require
        </p>
        <ul className="mt-3 grid gap-2 text-xs leading-5 text-[var(--ink-muted)] sm:grid-cols-2">
          {project.strongerDesigns.map((item) => (
            <li key={item}>• {item}</li>
          ))}
        </ul>
        <p className="mt-3 text-[10px] leading-5 text-[var(--ink-faint)]">
          These designs require defensible assumptions; their names do not
          automatically create causal evidence.
        </p>
      </section>
    </>
  );
}

function StepFooter({
  currentIndex,
  marked,
  onMark,
  onPrevious,
  onNext,
}: {
  currentIndex: number;
  marked: boolean;
  onMark: () => void;
  onPrevious: () => void;
  onNext: () => void;
}) {
  return (
    <div className="no-print mt-5 flex flex-wrap items-center justify-between gap-3">
      <Button
        variant="secondary"
        size="sm"
        disabled={currentIndex === 0}
        onClick={onPrevious}
      >
        <ArrowLeft size={13} />
        Previous
      </Button>
      <Button
        size="sm"
        variant={marked ? "secondary" : "primary"}
        onClick={onMark}
      >
        {marked ? (
          <>
            <CheckCircle2 size={13} />
            Section reviewed
          </>
        ) : (
          <>
            <ListChecks size={13} />
            Mark section reviewed
          </>
        )}
      </Button>
      <Button
        variant="secondary"
        size="sm"
        disabled={currentIndex === EVIDENCE_STEPS.length - 1}
        onClick={onNext}
      >
        Next
        <ArrowRight size={13} />
      </Button>
    </div>
  );
}

function ProjectConclusion({
  project,
  complete,
  onComplete,
  onMethod,
}: {
  project: EvidenceProject;
  complete: boolean;
  onComplete: () => void;
  onMethod: () => void;
}) {
  return (
    <section className="mt-7 rounded-xl border border-[var(--accent)] bg-[var(--accent-soft)] p-5 sm:p-7">
      <p className="text-[10px] font-bold tracking-[.12em] text-[var(--accent)]">
        PROJECT CONCLUSION
      </p>
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <InfoPanel title="Theory" text={project.conclusion.theory} />
        <InfoPanel
          title="Teaching calculation"
          text={project.conclusion.calculation}
        />
        <InfoPanel
          title="Evidence judgement"
          text={project.conclusion.judgement}
        />
      </div>
      <div className="mt-5 rounded-lg bg-[var(--surface)] p-4">
        <p className="text-xs font-bold">Best next question</p>
        <p className="mt-1 text-sm leading-6 text-[var(--ink-muted)]">
          {project.conclusion.nextQuestion}
        </p>
      </div>
      <div className="no-print mt-5 flex flex-wrap gap-2">
        <Button onClick={onComplete}>
          {complete ? (
            <>
              <CheckCircle2 size={14} />
              Project complete
            </>
          ) : (
            <>
              <BookOpenCheck size={14} />
              Mark Project Complete
            </>
          )}
        </Button>
        <Link href={project.relatedModels[0]?.href ?? "/models"}>
          <Button variant="secondary">Open Related Models</Button>
        </Link>
        <Link href={project.relatedCase.href}>
          <Button variant="secondary">Open Related Case</Button>
        </Link>
        <Button variant="secondary" onClick={onMethod}>
          Compare Methods
        </Button>
        <Link href="/research">
          <Button variant="ghost">Return to Evidence Lab</Button>
        </Link>
        <Button variant="ghost" onClick={() => window.print()}>
          <Printer size={14} />
          Print
        </Button>
      </div>
    </section>
  );
}
