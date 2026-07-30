"use client";

import { useMemo, useState } from "react";
import {
  CheckCircle2,
  CircleHelp,
  Lightbulb,
  LockKeyhole,
  Sigma,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MathFormula } from "@/components/ui/math-formula";
import {
  FINAL_WORLD_TEACHING,
  asArray,
  asRecord,
  numeric,
} from "@/lib/economics/final-world-teaching/catalog";
import {
  practiceFormula,
  practiceInputLatex,
  practiceSymbol,
} from "@/lib/models/practice-formulas";

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
type Question = {
  id: number;
  title: string;
  prompt: string;
  binary?: boolean;
  expected: boolean | number;
  hint: string;
};
const testCases = asArray<TestCase>(
  asRecord(FINAL_WORLD_TEACHING.extendedModelTestSuite).models,
);
const bindings = asArray<Binding>(
  asRecord(FINAL_WORLD_TEACHING.extendedPracticeQuestionBank).model_bindings,
);
const human = (value: string) =>
  value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

function makeQuestions(binding: Binding, test: TestCase): Question[] {
  const target = test.expected[binding.target_field];
  const numericTarget = typeof target === "number" ? target : 0;
  return [
    {
      id: 1,
      title: "Calculate the model output",
      prompt: `Use the fixed test input to calculate ${human(binding.target_field)}. Enter the numerical value that follows from the displayed equation.`,
      expected: numericTarget,
      hint: `Substitute only the supplied compatible-period inputs. The accepted tolerance is ${test.tolerance}.`,
    },
    {
      id: 2,
      title: "Read the result condition",
      binary: true,
      prompt: `For the fixed test input, does the stored condition ${human(binding.boolean_field)} evaluate to ${String(binding.boolean_value)}?`,
      expected: binding.boolean_value,
      hint: "Evaluate the stated condition from this test case rather than substituting a policy opinion.",
    },
    {
      id: 3,
      title: "Check units",
      binary: true,
      prompt: `Is this a unit-compatible interpretation of the output: “${binding.unit_claim}”?`,
      expected: binding.unit_claim_truth,
      hint: "Check whether the result is a stock, flow, rate, quantity, probability or currency amount on the stated time basis.",
    },
    {
      id: 4,
      title: "Check assumptions",
      binary: true,
      prompt: `Does this claim satisfy the model assumptions: “${binding.assumption_claim}”?`,
      expected: binding.assumption_claim_truth,
      hint: "The equation only applies inside its declared assumptions and market structure.",
    },
    {
      id: 5,
      title: "Respect the boundary",
      binary: true,
      prompt: `Can this model alone justify the statement: “${binding.boundary_claim}”?`,
      expected: binding.boundary_claim_truth,
      hint: "A conditional model result is not automatically an unconditional prediction or causal claim.",
    },
    {
      id: 6,
      title: "Validate the test assertion",
      binary: true,
      prompt: `Does “${binding.assertion}” match the versioned regression-test expectation?`,
      expected: binding.assertion_truth,
      hint: "Compare the assertion against the stored expected output and tolerance.",
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
  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState<boolean | null>(null);
  const [showHint, setShowHint] = useState(false);
  if (!binding || !test || !questions[index]) return null;
  const question = questions[index];
  const chooseModel = (next: string) => {
    setModelId(next);
    setIndex(0);
    setAnswer("");
    setResult(null);
    setShowHint(false);
  };
  const move = (next: number) => {
    setIndex(next);
    setAnswer("");
    setResult(null);
    setShowHint(false);
  };
  const check = () => {
    const correct = question.binary
      ? (answer === "true") === question.expected
      : Math.abs(Number(answer) - numeric(question.expected)) <= test.tolerance;
    setResult(correct);
  };

  return (
    <main className="mx-auto min-h-[calc(100vh-4rem)] max-w-[1360px] px-4 py-7 sm:px-6 lg:px-10 lg:py-10">
      <header className="border-b border-[var(--line)] pb-7">
        <p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-[var(--accent)]">
          Model learning system · binary mastery
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-[-.055em] sm:text-5xl">
          Model Practice
        </h1>
        <p className="mt-4 max-w-3xl text-base leading-7 text-[var(--ink-muted)]">
          Work through versioned, model-specific questions with unlimited
          retries. Each answer is simply correct or incorrect; no partial credit
          and no AI-generated evaluation.
        </p>
      </header>
      <div className="mt-7 grid gap-6 xl:grid-cols-[minmax(0,1fr)_330px] xl:items-start">
        <section className="min-w-0 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[var(--shadow)] sm:p-8">
          <QuestionProgress
            questions={questions}
            index={index}
            onChange={move}
          />
          <div className="mt-8 border-y border-[var(--line)] py-6">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-[var(--accent-soft)] text-[var(--accent)]">
                {human(binding.model_id)}
              </Badge>
              <Badge>
                Question {index + 1} of {questions.length}
              </Badge>
              <Badge className="bg-[var(--surface-subtle)]">
                {question.title}
              </Badge>
            </div>
            <p className="mt-5 max-w-4xl text-2xl font-bold leading-[1.25] tracking-[-.04em] sm:text-3xl">
              {question.prompt}
            </p>
          </div>
          <FormulaPanel
            modelId={binding.model_id}
            input={test.input}
            targetField={binding.target_field}
            numeric={Boolean(!question.binary)}
          />
          <section className="mt-8 rounded-xl bg-[var(--surface-subtle)] p-5 sm:p-6">
            <p className="text-xs font-bold text-[var(--ink-muted)]">
              Your response
            </p>
            {question.binary ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <AnswerChoice
                  selected={answer === "true"}
                  onClick={() => {
                    setAnswer("true");
                    setResult(null);
                  }}
                  label="Correct"
                  detail="The statement holds for this fixed test case."
                />
                <AnswerChoice
                  selected={answer === "false"}
                  onClick={() => {
                    setAnswer("false");
                    setResult(null);
                  }}
                  label="Incorrect"
                  detail="The statement does not hold for this fixed test case."
                />
              </div>
            ) : (
              <label className="mt-4 block max-w-xl text-xs font-bold text-[var(--ink-muted)]">
                Numerical answer
                <input
                  inputMode="decimal"
                  value={answer}
                  onChange={(event) => {
                    setAnswer(event.target.value);
                    setResult(null);
                  }}
                  placeholder="Enter a number"
                  className="mt-2 h-12 w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-4 text-lg font-semibold text-[var(--ink)] outline-none focus:border-[var(--accent)]"
                />
              </label>
            )}
          </section>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button onClick={check} disabled={answer === ""}>
              <CheckCircle2 size={15} />
              Check answer
            </Button>
            <Button
              variant="ghost"
              onClick={() => setShowHint((current) => !current)}
            >
              <Lightbulb size={15} />
              {showHint ? "Hide step hint" : "Show step hint"}
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
              className={`mt-5 flex items-center gap-2 rounded-xl border p-4 text-sm font-bold ${result ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]" : "border-[var(--red)] bg-[var(--red-soft)] text-[var(--red)]"}`}
            >
              {result ? (
                <>
                  <CheckCircle2 size={18} />
                  Correct.
                </>
              ) : (
                <>
                  <XCircle size={18} />
                  Incorrect. Try again or use the optional step hint.
                </>
              )}
            </div>
          )}
          <p className="mt-8 border-t border-[var(--line)] pt-5 text-xs leading-5 text-[var(--ink-faint)]">
            This exercise checks only the stored answer condition. It does not
            infer intent, award partial marks or call external AI services.
          </p>
        </section>
        <aside className="space-y-4 xl:sticky xl:top-20">
          <Card className="p-5">
            <label className="text-[10px] font-bold uppercase tracking-[.12em] text-[var(--ink-faint)]">
              Choose a model
              <select
                value={modelId}
                onChange={(event) => chooseModel(event.target.value)}
                className="mt-3 h-11 w-full rounded-lg border border-[var(--line)] bg-[var(--canvas)] px-3 text-sm font-semibold text-[var(--ink)]"
              >
                {bindings.map((item) => (
                  <option key={item.model_id} value={item.model_id}>
                    {human(item.model_id)}
                  </option>
                ))}
              </select>
            </label>
          </Card>
          <InputContext input={test.input} />
          <Card className="p-4">
            <p className="flex items-center gap-2 text-xs font-bold">
              <LockKeyhole size={14} className="text-[var(--accent)]" />
              Versioned question context
            </p>
            <p className="mt-2 text-xs leading-5 text-[var(--ink-muted)]">
              The formula catalogue, test-suite input and answer tolerance are
              locked for this question. Only your response is adjustable.
            </p>
          </Card>
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold tracking-[.12em] text-[var(--accent)]">
            PRACTICE PATH
          </p>
          <p className="mt-1 text-sm font-bold">One model, six checks</p>
        </div>
        <p className="text-xs text-[var(--ink-muted)]">Unlimited retries</p>
      </div>
      <ol className="mt-5 grid grid-cols-3 gap-2 sm:grid-cols-6">
        {questions.map((item, itemIndex) => (
          <li key={item.id}>
            <button
              type="button"
              aria-label={`Open question ${itemIndex + 1}: ${item.title}`}
              onClick={() => onChange(itemIndex)}
              className={`w-full rounded-lg border p-3 text-left transition-colors ${itemIndex === index ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]" : "border-[var(--line)] text-[var(--ink-muted)] hover:bg-[var(--surface-subtle)]"}`}
            >
              <span className="text-[10px] font-bold">0{itemIndex + 1}</span>
              <span className="mt-1 block truncate text-[10px] font-bold">
                {item.title.replace(" the ", " ")}
              </span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}

function FormulaPanel({
  modelId,
  input,
  targetField,
  numeric,
}: {
  modelId: string;
  input: Record<string, unknown>;
  targetField: string;
  numeric: boolean;
}) {
  return (
    <section className="mt-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-xs font-bold">
            <Sigma size={16} className="text-[var(--accent)]" />
            Versioned model equation
          </p>
          <p className="mt-1 text-xs text-[var(--ink-muted)]">
            Rendered from the model formula catalogue.
          </p>
        </div>
        {numeric && (
          <Badge className="bg-[var(--accent-soft)] text-[var(--accent)]">
            Solve for <MathFormula expression={practiceSymbol(targetField)} />
          </Badge>
        )}
      </div>
      <div className="mt-3 overflow-x-auto rounded-xl border border-[var(--line)] bg-[var(--canvas)] px-5 py-6 sm:px-7">
        <MathFormula
          block
          expression={practiceFormula(modelId)}
          className="min-w-max text-center text-xl text-[var(--ink)] sm:text-2xl"
        />
        <div className="mt-5 border-t border-[var(--line)] pt-4">
          <p className="text-[10px] font-bold uppercase tracking-[.12em] text-[var(--ink-faint)]">
            Supplied values
          </p>
          <MathFormula
            block
            expression={practiceInputLatex(input)}
            className="mt-3 min-w-max text-center text-base text-[var(--ink-muted)]"
          />
        </div>
      </div>
    </section>
  );
}

function AnswerChoice({
  selected,
  onClick,
  label,
  detail,
}: {
  selected: boolean;
  onClick: () => void;
  label: string;
  detail: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border p-4 text-left transition-colors ${selected ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]" : "border-[var(--line)] bg-[var(--surface)] hover:bg-[var(--canvas)]"}`}
    >
      <span className="text-base font-bold">{label}</span>
      <span className="mt-1 block text-xs leading-5 text-[var(--ink-muted)]">
        {detail}
      </span>
    </button>
  );
}

function InputContext({ input }: { input: Record<string, unknown> }) {
  return (
    <Card className="p-5">
      <p className="flex items-center gap-2 text-xs font-bold">
        <CircleHelp size={14} className="text-[var(--accent)]" />
        Fixed source input
      </p>
      <p className="mt-2 text-xs leading-5 text-[var(--ink-muted)]">
        These are locked test values. The same values appear in the formula
        substitution.
      </p>
      <dl className="mt-4 space-y-2">
        {Object.entries(input).map(([key, value]) => (
          <div
            key={key}
            className="rounded-lg bg-[var(--surface-subtle)] px-3 py-2"
          >
            <dt className="text-[10px] font-bold text-[var(--ink-faint)]">
              {key}
            </dt>
            <dd className="mt-1 overflow-x-auto text-sm text-[var(--ink)]">
              <MathFormula expression={practiceInputLatex({ [key]: value })} />
            </dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}
