"use client";

import { useMemo, useState } from "react";
import {
  CheckCircle2,
  CircleHelp,
  Lightbulb,
  ListChecks,
  LockKeyhole,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MathFormula } from "@/components/ui/math-formula";
import { PracticeMiniLab } from "@/components/learning/practice-mini-lab";
import {
  FINAL_WORLD_TEACHING,
  asArray,
  asRecord,
} from "@/lib/economics/final-world-teaching/catalog";
import { practiceInputLatex } from "@/lib/models/practice-formulas";

type TestCase = {
  id: string;
  input: Record<string, unknown>;
  expected: Record<string, unknown>;
  tolerance: number;
};
type Binding = {
  model_id: string;
  target_field: string;
  boolean_field: string;
  boolean_value: boolean;
  unit_claim: string;
  unit_claim_truth: boolean;
  assumption_claim: string;
  assumption_claim_truth: boolean;
  boundary_claim: string;
  boundary_claim_truth: boolean;
  assertion: string;
  assertion_truth: boolean;
};
type Choice = { id: string; label: string; detail: string; correct: boolean };
type Question = {
  id: number;
  title: string;
  prompt: string;
  hint: string;
  choices: Choice[];
};

const testCases = asArray<TestCase>(
  asRecord(FINAL_WORLD_TEACHING.extendedModelTestSuite).models,
);
const bindings = asArray<Binding>(
  asRecord(FINAL_WORLD_TEACHING.extendedPracticeQuestionBank).model_bindings,
);
const human = (value: string) =>
  value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

function displayValue(value: unknown) {
  if (typeof value === "number") {
    return new Intl.NumberFormat("en-US", { maximumFractionDigits: 5 }).format(
      value,
    );
  }
  if (Array.isArray(value)) return `[${value.join(", ")}]`;
  return String(value);
}

function numericChoices(value: number, questionId: number): Choice[] {
  const gap = Math.max(Math.abs(value) * 0.2, value === 0 ? 1 : 0.25);
  const candidates = [value, value + gap, value - gap, value + gap * 2].map(
    (item) => Number(item.toFixed(5)),
  );
  const correct = candidates[0];
  const shifted = candidates.map(
    (_, index) =>
      candidates[
        (index + (questionId % candidates.length)) % candidates.length
      ],
  );
  return shifted.map((item, index) => ({
    id: `numeric-${index}`,
    label: displayValue(item),
    detail: "Model output",
    correct: item === correct,
  }));
}

function valueChoices(value: unknown, questionId: number): Choice[] {
  if (typeof value === "number") return numericChoices(value, questionId);
  if (typeof value === "boolean") return trueFalseChoices(value);
  if (typeof value === "string") {
    const candidates = [
      value,
      value === "A" ? "B" : "A",
      "Cannot be determined",
      "Both",
    ];
    return candidates.map((item, index) => ({
      id: `value-${index}`,
      label: item,
      detail: "Model output",
      correct: item === value,
    }));
  }
  if (Array.isArray(value) && value.every((item) => typeof item === "number")) {
    const base = value as number[];
    const candidates = [
      base,
      base.map((item) => item + 1),
      [...base].reverse(),
      base.map((item, index) => item + (index === 0 ? -1 : 0)),
    ];
    const shift = questionId % candidates.length;
    return candidates
      .map((_, index) => candidates[(index + shift) % candidates.length])
      .map((item, index) => ({
        id: `array-${index}`,
        label: displayValue(item),
        detail: "Model output",
        correct: item.every((entry, entryIndex) => entry === base[entryIndex]),
      }));
  }
  return [
    {
      id: "result",
      label: displayValue(value),
      detail: "Model output",
      correct: true,
    },
    {
      id: "alternate",
      label: "A different result",
      detail: "Model output",
      correct: false,
    },
  ];
}

function yesNoChoices(correct: boolean): Choice[] {
  return [
    {
      id: "yes",
      label: "Yes",
      detail: "The statement holds for this scenario.",
      correct,
    },
    {
      id: "no",
      label: "No",
      detail: "The statement does not hold for this scenario.",
      correct: !correct,
    },
  ];
}

function trueFalseChoices(correct: boolean): Choice[] {
  return [
    {
      id: "true",
      label: "True",
      detail: "The stored condition is true.",
      correct,
    },
    {
      id: "false",
      label: "False",
      detail: "The stored condition is false.",
      correct: !correct,
    },
  ];
}

function makeQuestions(binding: Binding, test: TestCase): Question[] {
  const target = test.expected[binding.target_field];
  return [
    {
      id: 1,
      title: "Calculate the output",
      prompt: `Using the fixed assessment scenario, which value is the model output for ${human(binding.target_field)}?`,
      choices: valueChoices(target, 1),
      hint: "Use the fixed assessment values below. The live model on the right is for exploration and does not change this question.",
    },
    {
      id: 2,
      title: "Read the condition",
      prompt: `For the fixed scenario, which state does ${human(binding.boolean_field)} take?`,
      choices: trueFalseChoices(binding.boolean_value),
      hint: "Evaluate the stored condition from the fixed scenario, not from a policy opinion.",
    },
    {
      id: 3,
      title: "Check units",
      prompt: `Is this a unit-compatible interpretation: “${binding.unit_claim}”?`,
      choices: yesNoChoices(binding.unit_claim_truth),
      hint: "Check whether the result is a stock, flow, rate, quantity, probability or currency amount on the stated time basis.",
    },
    {
      id: 4,
      title: "Check assumptions",
      prompt: `Does this claim satisfy the model assumptions: “${binding.assumption_claim}”?`,
      choices: yesNoChoices(binding.assumption_claim_truth),
      hint: "The formula applies only inside its stated market structure and assumptions.",
    },
    {
      id: 5,
      title: "Respect the boundary",
      prompt: `Can this model alone justify the statement: “${binding.boundary_claim}”?`,
      choices: yesNoChoices(binding.boundary_claim_truth),
      hint: "A conditional model result is not automatically an unconditional prediction or causal claim.",
    },
    {
      id: 6,
      title: "Validate the assertion",
      prompt: `Does “${binding.assertion}” match the stored regression-test expectation?`,
      choices: yesNoChoices(binding.assertion_truth),
      hint: "Compare the assertion with the locked expected output rather than the exploratory settings on the right.",
    },
  ];
}

export function ModelPractice() {
  const [modelId, setModelId] = useState(bindings[0]?.model_id ?? "");
  const binding =
    bindings.find((item) => item.model_id === modelId) ?? bindings[0];
  const test = testCases.find((item) => item.id === modelId) ?? testCases[0];
  const questions = useMemo(
    () => (binding && test ? makeQuestions(binding, test) : []),
    [binding, test],
  );
  const [index, setIndex] = useState(0);
  const [choiceId, setChoiceId] = useState<string | null>(null);
  const [result, setResult] = useState<boolean | null>(null);
  const [showHint, setShowHint] = useState(false);

  if (!binding || !test || !questions[index]) return null;
  const question = questions[index];
  const selected = question.choices.find((choice) => choice.id === choiceId);

  const chooseModel = (next: string) => {
    setModelId(next);
    setIndex(0);
    setChoiceId(null);
    setResult(null);
    setShowHint(false);
  };
  const move = (next: number) => {
    setIndex(next);
    setChoiceId(null);
    setResult(null);
    setShowHint(false);
  };

  return (
    <main className="mx-auto min-h-[calc(100vh-4rem)] max-w-[1540px] px-4 py-7 sm:px-6 lg:px-10 lg:py-10">
      <header className="border-b border-[var(--line)] pb-7">
        <p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-[var(--accent)]">
          Model learning system · guided practice
        </p>
        <div className="mt-3 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div>
            <h1 className="text-4xl font-bold tracking-[-.055em] sm:text-5xl">
              Model Practice
            </h1>
            <p className="mt-3 max-w-3xl text-base leading-7 text-[var(--ink-muted)]">
              Choose an answer on the left, then use the live mini model on the
              right to explore the economic mechanism. Assessment answers remain
              fixed and are judged only as correct or incorrect.
            </p>
          </div>
          <label className="block w-full max-w-md text-[10px] font-bold uppercase tracking-[.12em] text-[var(--ink-faint)]">
            Practice model
            <select
              value={modelId}
              onChange={(event) => chooseModel(event.target.value)}
              className="mt-2 h-12 w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 text-sm font-semibold normal-case tracking-normal text-[var(--ink)]"
            >
              {bindings.map((item) => (
                <option key={item.model_id} value={item.model_id}>
                  {human(item.model_id)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </header>

      <div className="mt-7 grid gap-6 xl:grid-cols-[minmax(430px,.88fr)_minmax(0,1.35fr)] xl:items-start">
        <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[var(--shadow)] sm:p-7">
          <QuestionProgress
            questions={questions}
            index={index}
            onChange={move}
          />
          <div className="mt-7 border-y border-[var(--line)] py-6">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-[var(--accent-soft)] text-[var(--accent)]">
                {human(binding.model_id)}
              </Badge>
              <Badge>
                Question {index + 1} / {questions.length}
              </Badge>
            </div>
            <h2 className="mt-5 text-2xl font-bold leading-[1.26] tracking-[-.04em] sm:text-3xl">
              {question.prompt}
            </h2>
          </div>

          <div className="mt-6">
            <p className="flex items-center gap-2 text-xs font-bold text-[var(--ink-muted)]">
              <ListChecks size={15} className="text-[var(--accent)]" />
              Choose one answer
            </p>
            <div className="mt-3 grid gap-3">
              {question.choices.map((choice, choiceIndex) => (
                <ChoiceCard
                  key={choice.id}
                  choice={choice}
                  label={String.fromCharCode(65 + choiceIndex)}
                  selected={choice.id === choiceId}
                  onClick={() => {
                    setChoiceId(choice.id);
                    setResult(null);
                  }}
                />
              ))}
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <Button
              onClick={() => setResult(selected?.correct ?? false)}
              disabled={!selected}
            >
              <CheckCircle2 size={15} /> Check answer
            </Button>
            <Button
              variant="ghost"
              onClick={() => setShowHint((current) => !current)}
            >
              <Lightbulb size={15} />
              {showHint ? "Hide hint" : "Show hint"}
            </Button>
          </div>

          {showHint && (
            <div className="mt-4 rounded-xl border border-[var(--amber)] bg-[var(--amber-soft)] p-4 text-sm leading-6 text-[var(--ink-muted)]">
              <p className="font-bold text-[var(--ink)]">Step hint</p>
              <p className="mt-1">{question.hint}</p>
            </div>
          )}
          {result !== null && (
            <div
              className={`mt-4 flex items-center gap-2 rounded-xl border p-4 text-sm font-bold ${result ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]" : "border-[var(--red)] bg-[var(--red-soft)] text-[var(--red)]"}`}
            >
              {result ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
              {result
                ? "Correct."
                : "Incorrect. Re-check the fixed scenario or use the hint."}
            </div>
          )}

          <ScenarioReference input={test.input} tolerance={test.tolerance} />
        </section>

        <aside className="xl:sticky xl:top-20">
          <PracticeMiniLab key={modelId} modelId={modelId} />
        </aside>
      </div>
    </main>
  );
}

function QuestionProgress({
  questions,
  index,
  onChange,
}: {
  questions: Question[];
  index: number;
  onChange: (index: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold tracking-[.12em] text-[var(--accent)]">
            PRACTICE PATH
          </p>
          <p className="mt-1 text-sm font-bold">One model, six checks</p>
        </div>
        <p className="text-xs text-[var(--ink-muted)]">Unlimited retries</p>
      </div>
      <ol className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
        {questions.map((item, itemIndex) => (
          <li key={item.id}>
            <button
              type="button"
              aria-label={`Open question ${itemIndex + 1}: ${item.title}`}
              onClick={() => onChange(itemIndex)}
              className={`w-full rounded-lg border p-2.5 text-left transition-colors ${itemIndex === index ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]" : "border-[var(--line)] text-[var(--ink-muted)] hover:bg-[var(--surface-subtle)]"}`}
            >
              <span className="text-[10px] font-bold">0{itemIndex + 1}</span>
              <span className="mt-1 block truncate text-[10px] font-bold">
                {item.title}
              </span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}

function ChoiceCard({
  choice,
  label,
  selected,
  onClick,
}: {
  choice: Choice;
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-4 rounded-xl border p-4 text-left transition-colors ${selected ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-[var(--line)] bg-[var(--canvas)] hover:bg-[var(--surface-subtle)]"}`}
    >
      <span
        className={`grid size-8 shrink-0 place-items-center rounded-full text-xs font-extrabold ${selected ? "bg-[var(--accent)] text-white" : "bg-[var(--surface)] text-[var(--ink-muted)]"}`}
      >
        {label}
      </span>
      <span>
        <span className="block text-base font-bold text-[var(--ink)]">
          {choice.label}
        </span>
        <span className="mt-0.5 block text-xs text-[var(--ink-muted)]">
          {choice.detail}
        </span>
      </span>
    </button>
  );
}

function ScenarioReference({
  input,
  tolerance,
}: {
  input: Record<string, unknown>;
  tolerance: number;
}) {
  return (
    <section className="mt-7 border-t border-[var(--line)] pt-5">
      <p className="flex items-center gap-2 text-xs font-bold">
        <LockKeyhole size={14} className="text-[var(--accent)]" />
        Fixed assessment scenario
      </p>
      <p className="mt-2 text-xs leading-5 text-[var(--ink-muted)]">
        These supplied values are locked for this question. The right-hand mini
        model is a separate, safe space to test what changes when inputs move.
      </p>
      <div className="mt-3 overflow-x-auto rounded-lg bg-[var(--surface-subtle)] px-4 py-3">
        <MathFormula
          block
          expression={practiceInputLatex(input)}
          className="min-w-max text-left text-sm text-[var(--ink-muted)]"
        />
      </div>
      <p className="mt-2 flex items-center gap-1.5 text-[10px] text-[var(--ink-faint)]">
        <CircleHelp size={12} /> Numerical answer tolerance: {tolerance}
      </p>
    </section>
  );
}
