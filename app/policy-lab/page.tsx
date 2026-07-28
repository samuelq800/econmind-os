"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, CircleGauge, Leaf, Scale, Target, Users } from "lucide-react";
import { EconomicEvaluation } from "@/components/models/economic-evaluation";
import { EconomicExplanation } from "@/components/models/economic-explanation";
import { EquationView } from "@/components/models/equation-view";
import { MechanismChain } from "@/components/models/mechanism-chain";
import { MetricCard } from "@/components/models/metric-card";
import { ModelAssumptions } from "@/components/models/model-assumptions";
import { ModelWorkspace } from "@/components/models/model-workspace";
import { ParameterControl } from "@/components/models/parameter-control";
import { PolicyTransmissionMap } from "@/components/models/policy-transmission-map";
import { ScenarioComparison } from "@/components/models/scenario-comparison";
import { StakeholderImpact, type StakeholderImpactItem } from "@/components/models/stakeholder-impact";
import { ModelIntroduction } from "@/components/models/model-introduction";
import { CrossModelTransmissionView } from "@/components/models/cross-model-transmission-view";
import { Button } from "@/components/ui/button";
import { calculateIsLm, DEFAULT_IS_LM } from "@/lib/economics/is-lm";
import { DEFAULT_REPEATED_GAME, simulateRepeatedGame } from "@/lib/economics/game-theory";
import { calculatePhillips, DEFAULT_PHILLIPS } from "@/lib/economics/phillips";
import { BASELINE_PARAMETERS, POLICY_DEFINITIONS } from "@/lib/economics/sandbox/defaults";
import { simulateSandbox } from "@/lib/economics/sandbox/simulation";
import type { SandboxParameters } from "@/lib/economics/sandbox/types";
import type { ModelParameter } from "@/lib/economics/types";
import { usePersistentState } from "@/lib/hooks/use-persistent-state";
import { useParameterChange } from "@/lib/hooks/use-recent-parameter";
import { parameterLabel } from "@/lib/models/change-tracking";
import { mapSandboxToMacro } from "@/lib/models/model-mapping";
import type { AssumptionSections } from "@/lib/models/assumptions";
import type { MechanismStep } from "@/lib/models/explanations";

type ScenarioKey = "inflation" | "carbon" | "climate";
type Priority = "Price stability" | "Employment" | "Growth" | "Emissions" | "Consumer welfare" | "Cooperation";

const scenarioConfig: Record<ScenarioKey, { title: string; brief: string; objective: string; controls: Array<keyof SandboxParameters>; priorityOptions: Priority[]; initial: Partial<SandboxParameters> }> = {
  inflation: {
    title: "Inflation Crisis",
    brief: "Inflation is above the preferred range while output and employment remain politically important. Use only the listed fiscal and monetary levers.",
    objective: "Reduce inflation while limiting output and employment losses.",
    controls: ["interestRate", "moneySupplyGrowth", "governmentSpending", "incomeTaxRate"],
    priorityOptions: ["Price stability", "Employment", "Growth"],
    initial: { interestRate: 6, moneySupplyGrowth: 6, governmentSpending: 112, incomeTaxRate: 25 },
  },
  carbon: {
    title: "Carbon Transition",
    brief: "Emissions must fall while households, firms, and the public budget face competing pressures.",
    objective: "Reduce emissions without ignoring welfare, profitability, or fiscal capacity.",
    controls: ["carbonTax", "greenSubsidy", "subsidyRate", "governmentSpending"],
    priorityOptions: ["Emissions", "Consumer welfare", "Growth"],
    initial: { carbonTax: 40, greenSubsidy: 12, subsidyRate: 5, governmentSpending: 104 },
  },
  climate: {
    title: "Climate Cooperation",
    brief: "Countries face incentives to free ride. Sandbox instruments represent the domestic policy package while the game layer makes cooperation incentives explicit.",
    objective: "Create incentives for durable mutual climate cooperation under possible free riding.",
    controls: ["carbonTax", "greenSubsidy", "governmentSpending", "subsidyRate"],
    priorityOptions: ["Cooperation", "Emissions", "Consumer welfare"],
    initial: { carbonTax: 30, greenSubsidy: 20, governmentSpending: 105, subsidyRate: 7 },
  },
};

const policyAssumptions: AssumptionSections = {
  structural: ["Each scenario locks its background and exposes only a limited policy set.", "Sandbox effects use standardized deterministic coefficients and the scenario layer does not duplicate them."],
  parameters: ["A selected priority determines the transparent teaching score.", "Scores compare current results with the scenario objective; they are not real policy forecasts."],
  limitations: ["The scenarios do not estimate causal effects, distributional microdata, political feasibility, or implementation capacity.", "Different priorities can rationally lead to different recommendations."],
};

function control(key: keyof SandboxParameters): ModelParameter {
  const found = POLICY_DEFINITIONS.find((item) => item.key === key)!;
  return { id: found.key, label: found.label, symbol: found.unit.trim() || "index", description: found.description, min: found.min, max: found.max, step: found.step, defaultValue: BASELINE_PARAMETERS[key] };
}

export default function PolicyLabPage() {
  const [scenario, setScenario] = useState<ScenarioKey>("inflation");
  const [priority, setPriority] = useState<Priority>("Price stability");
  const [prediction, setPrediction] = useState("");
  const [submittedPrediction, setSubmittedPrediction] = useState("");
  const [parameters, setParameters] = usePersistentState<SandboxParameters>("econmind:policy-lab", { ...BASELINE_PARAMETERS, ...scenarioConfig.inflation.initial });
  const config = scenarioConfig[scenario];
  const result = useMemo(() => simulateSandbox(parameters), [parameters]);
  const analysis = useMemo(() => scenarioAnalysis(scenario, priority, result), [scenario, priority, result]);
  const latestChange = useParameterChange(parameters, "policy-lab");
  const dynamicMechanism = latestChange
    ? [{ stage: "Latest policy change", text: `${parameterLabel("policy-lab", latestChange.parameterKey)} ${latestChange.direction} from ${String(latestChange.previousValue)} to ${String(latestChange.currentValue)}.` }, ...analysis.mechanism.slice(1)]
    : analysis.mechanism;

  function chooseScenario(next: ScenarioKey) {
    setScenario(next);
    setPriority(scenarioConfig[next].priorityOptions[0]);
    setPrediction("");
    setSubmittedPrediction("");
    setParameters({ ...BASELINE_PARAMETERS, ...scenarioConfig[next].initial });
  }
  function update(key: keyof SandboxParameters, value: number) { setParameters((current) => ({ ...current, [key]: value })); }

  return <main className="min-h-screen">
    <header className="border-b border-[var(--line)] bg-[var(--surface)] px-5 py-8 sm:px-8 lg:px-10"><div className="mx-auto max-w-[1440px]"><p className="text-[10px] font-extrabold uppercase tracking-[.18em] text-[var(--accent)]">Structured policy simulation</p><h1 className="mt-3 text-4xl font-bold tracking-[-.05em] sm:text-5xl">Policy Lab</h1><p className="mt-3 max-w-3xl text-base leading-7 text-[var(--ink-muted)]">Start with a fixed economic brief, choose what matters most, predict the direction of change, and defend a recommendation using transparent, stylised mechanisms.</p><div className="mt-7"><ModelIntroduction modelKey="policy-lab" modelLabel="Policy Lab" /></div></div></header>
    <div className="mx-auto max-w-[1500px] p-4 sm:p-6 lg:p-8">
      <section className="grid gap-3 md:grid-cols-3">{(Object.keys(scenarioConfig) as ScenarioKey[]).map((key) => <button type="button" key={key} onClick={() => chooseScenario(key)} className={"rounded-xl border p-5 text-left transition focus:outline-none focus:ring-2 focus:ring-[var(--accent)] " + (scenario === key ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-[var(--line)] bg-[var(--surface)] hover:bg-[var(--surface-subtle)]")}><p className="text-sm font-bold">{scenarioConfig[key].title}</p><p className="mt-2 text-xs leading-5 text-[var(--ink-muted)]">{scenarioConfig[key].objective}</p></button>)}</section>
      <section className="mt-5 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5 sm:p-6"><div className="grid gap-5 lg:grid-cols-[1.3fr_1fr_1fr]"><div><p className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--accent)]">1. Economic brief</p><h2 className="mt-2 text-xl font-bold">{config.title}</h2><p className="mt-3 text-sm leading-6 text-[var(--ink-muted)]">{config.brief}</p></div><label className="text-sm font-bold"><span className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--accent)]">2. Priority</span><select value={priority} onChange={(event) => setPriority(event.target.value as Priority)} className="mt-3 h-11 w-full rounded-lg border border-[var(--line-strong)] bg-[var(--canvas)] px-3 font-normal"><>{config.priorityOptions.map((item) => <option key={item}>{item}</option>)}</></select></label><div><p className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--accent)]">3. Prediction</p><input value={prediction} onChange={(event) => setPrediction(event.target.value)} maxLength={220} placeholder="What do you expect, and why?" className="mt-3 h-11 w-full rounded-lg border border-[var(--line-strong)] bg-[var(--canvas)] px-3 text-sm outline-none focus:border-[var(--accent)]" /><Button className="mt-2" size="sm" disabled={!prediction.trim()} onClick={() => setSubmittedPrediction(prediction.trim())}>Lock prediction</Button>{submittedPrediction && <p className="mt-2 text-xs leading-5 text-[var(--accent)]"><CheckCircle2 className="mr-1 inline" size={13} />Prediction recorded locally for this session.</p>}</div></div></section>
      <ModelWorkspace
        onReset={() => setParameters({ ...BASELINE_PARAMETERS, ...config.initial })}
        controls={<>{config.controls.map((key) => <ParameterControl key={key} parameter={control(key)} value={parameters[key]} onChange={(value) => update(key, value)} />)}<div className="mt-4 rounded-lg bg-[var(--surface-subtle)] p-3 text-xs leading-5 text-[var(--ink-muted)]">Only the scenario’s listed controls are available. All calculations are immediate and remain in this browser until you deliberately save a result.</div></>}
        chart={<PolicyTransmissionMap result={result} modelLabel={config.title} />}
        metrics={<><MetricCard label="Priority score" value={analysis.score + "/100"} note={"Teaching score for " + priority} icon={Target} tone={analysis.score >= 70 ? "green" : analysis.score >= 45 ? "amber" : "red"} /><MetricCard label="Inflation" value={result.indicators.inflationRate + "%"} note="Sandbox indicator" icon={CircleGauge} tone={result.indicators.inflationRate <= 3 ? "green" : "red"} /><MetricCard label="Unemployment" value={result.indicators.unemploymentRate + "%"} note="Sandbox indicator" icon={Users} tone={result.indicators.unemploymentRate <= 5 ? "green" : "amber"} /><MetricCard label="GDP index" value={result.indicators.gdpIndex} note="Sandbox indicator" icon={Scale} tone="blue" /><MetricCard label="Emissions" value={result.indicators.carbonEmissions} note="Lower is cleaner" icon={Leaf} tone={result.indicators.carbonEmissions < 100 ? "green" : "red"} /><MetricCard label="Recommendation" value={analysis.recommendation} note="Conditional on your priority" icon={Target} tone="neutral" /></>}
        explanation={<><EconomicExplanation principle="A policy package should be judged against explicitly selected objectives and constraints, not by a single outcome." modelLabel={config.title}>{analysis.interpretation}</EconomicExplanation>{scenario === "inflation" && <CrossModelTransmissionView state={mapSandboxToMacro(parameters)} modelLabel={config.title} />}<MechanismChain modelKey="policy-lab" parameters={parameters} steps={dynamicMechanism} modelLabel={config.title} /><EquationView steps={analysis.equations} modelLabel={config.title} /><ModelAssumptions assumptions={policyAssumptions} modelLabel={config.title} /><StakeholderImpact items={analysis.stakeholders as StakeholderImpactItem[]} modelLabel={config.title} /><EconomicEvaluation items={analysis.evaluation} modelLabel={config.title} /></>}
        comparison={<ScenarioComparison storageKey={"econmind:policy-lab:" + scenario} modelKey="policy-lab" parameters={parameters} results={{ score: analysis.score, inflation: result.indicators.inflationRate, unemployment: result.indicators.unemploymentRate, gdp: result.indicators.gdpIndex, emissions: result.indicators.carbonEmissions, consumerWelfare: result.indicators.consumerWelfare }} metrics={["score", "inflation", "unemployment", "gdp", "emissions", "consumerWelfare"]} onLoadParameters={(saved) => setParameters((current) => ({ ...current, ...saved }))} />}/>
    </div>
  </main>;
}

function scenarioAnalysis(scenario: ScenarioKey, priority: Priority, result: ReturnType<typeof simulateSandbox>) {
  const i = result.indicators;
  const islm = calculateIsLm({ ...DEFAULT_IS_LM, governmentSpending: 35 + (result.parameters.governmentSpending - 100) * 0.6, taxation: result.parameters.incomeTaxRate, moneySupply: 80 + result.parameters.moneySupplyGrowth * 3 });
  const phillips = calculatePhillips({ ...DEFAULT_PHILLIPS, unemployment: i.unemploymentRate, demandPressure: (i.gdpIndex - 100) / 8, supplyShock: Math.max(0, i.inflationRate - 2) / 5 });
  const game = simulateRepeatedGame({ ...DEFAULT_REPEATED_GAME, strategyA: "tit-for-tat", strategyB: "tit-for-tat", rounds: 10, discountFactor: Math.min(1, 0.6 + result.parameters.greenSubsidy / 100), ccA: 3 + result.parameters.greenSubsidy / 25, ccB: 3 + result.parameters.greenSubsidy / 25, ddA: 1 - result.parameters.carbonTax / 150, ddB: 1 - result.parameters.carbonTax / 150 });
  const score = priority === "Price stability" ? clamp(100 - Math.abs(i.inflationRate - 2) * 14 - Math.max(0, i.unemploymentRate - 6) * 6) : priority === "Employment" ? clamp(100 - Math.max(0, i.unemploymentRate - 3) * 13 - Math.max(0, i.inflationRate - 4) * 5) : priority === "Growth" ? clamp(i.gdpIndex - Math.max(0, i.inflationRate - 4) * 5) : priority === "Emissions" ? clamp(100 + (100 - i.carbonEmissions) * 2 - Math.max(0, i.unemploymentRate - 6) * 4) : priority === "Consumer welfare" ? clamp(i.consumerWelfare - Math.max(0, i.inflationRate - 4) * 4) : clamp(game.cooperationRate + (100 - i.carbonEmissions) * 0.4);
  const recommendation = score >= 75 ? "Strong fit" : score >= 50 ? "Trade-off" : "Revise mix";
  const scenarioText = scenario === "inflation" ? "The sandbox outcome is linked to an educational IS–LM reading: output " + islm.output + " and interest rate " + islm.interestRate + ". The related Phillips reading gives inflation " + phillips.inflation + "%." : scenario === "carbon" ? "The carbon package produces emissions " + i.carbonEmissions + ", consumer welfare " + i.consumerWelfare + ", firm profit " + i.firmProfit + ", and revenue " + i.governmentRevenue + "." : "The policy mix affects domestic emissions while the cooperation layer produces a " + game.cooperationRate + "% mutual-cooperation rate under the selected repeated-game conditions.";
  return {
    score: Math.round(score), recommendation,
    interpretation: "Your highest priority is " + priority + ". " + scenarioText + " The score is a transparent classroom aid, not a real-world forecast or policy prescription.",
    mechanism: chain("The selected scenario controls change.", "The existing Sandbox engine recomputes direct and interaction contributions.", "Output, inflation, unemployment, emissions, and fiscal indicators update.", scenario === "inflation" ? "IS–LM and Phillips readings interpret the macro transmission." : scenario === "carbon" ? "Firms and consumers respond through the modelled carbon and subsidy channels." : "Repeated interaction links current incentives to cooperation behaviour.", "Current priority score: " + Math.round(score) + "/100.", "Recommendation: " + recommendation + " conditional on " + priority + "."),
    equations: scenario === "inflation" ? [{ label: "Sandbox link", expression: "Selected fiscal and monetary values feed the shared Sandbox result." }, { label: "IS–LM reading", expression: "Y = " + islm.output + "; i = " + islm.interestRate }, { label: "Phillips reading", expression: "π = πe − α(u − un) + v + d = " + phillips.inflation + "%" }] : scenario === "carbon" ? [{ label: "Shared engine", expression: "Total outcome = baseline + direct contributions + interaction contributions" }, { label: "Carbon interaction", expression: "Carbon tax × green subsidy is calculated once in the Sandbox engine." }, { label: "Current emissions", expression: "Emissions index = " + i.carbonEmissions }] : [{ label: "Shared engine", expression: "Domestic outcomes come from the Sandbox engine." }, { label: "Repeated interaction", expression: "V_i = Σ β^(t−1)u_i,t; cooperation = " + game.cooperationRate + "%" }, { label: "Current emissions", expression: "Emissions index = " + i.carbonEmissions }],
    stakeholders: scenario === "inflation" ? [{ stakeholder: "Households", direction: i.inflationRate <= 3 ? "Gains" : "Loses", shortRun: "Purchasing-power pressure follows inflation.", reason: "Inflation is " + i.inflationRate + "%." }, { stakeholder: "Workers", direction: i.unemploymentRate <= 5 ? "Gains" : "Loses", shortRun: "Employment pressure is represented by unemployment.", reason: "Unemployment is " + i.unemploymentRate + "%." }, { stakeholder: "Firms", direction: islm.investment >= 20 ? "Mixed" : "Loses", shortRun: "Investment reacts to the IS–LM interest rate.", reason: "Investment reading is " + islm.investment + "." }] : scenario === "carbon" ? [{ stakeholder: "Consumers", direction: i.consumerWelfare >= 100 ? "Gains" : "Loses", shortRun: "Welfare index is " + i.consumerWelfare + ".", reason: "Policies alter standardized prices and output channels." }, { stakeholder: "Firms", direction: i.firmProfit >= 100 ? "Gains" : "Loses", shortRun: "Profit index is " + i.firmProfit + ".", reason: "Carbon pricing and subsidies have separate and interaction effects." }, { stakeholder: "Future society", direction: i.carbonEmissions < 100 ? "Gains" : "Loses", shortRun: "Emissions index is " + i.carbonEmissions + ".", reason: "Lower emissions are a modelled environmental benefit." }] : [{ stakeholder: "Cooperating countries", direction: game.cooperationRate >= 50 ? "Gains" : "Mixed", shortRun: "Mutual cooperation occurs in " + game.cooperationRate + "% of rounds.", reason: "Future weight and incentives shape strategy responses." }, { stakeholder: "Domestic households", direction: i.consumerWelfare >= 100 ? "Gains" : "Loses", shortRun: "Consumer welfare index is " + i.consumerWelfare + ".", reason: "Domestic policy package is calculated by Sandbox." }, { stakeholder: "Future society", direction: i.carbonEmissions < 100 ? "Gains" : "Loses", shortRun: "Emissions index is " + i.carbonEmissions + ".", reason: "Climate benefits depend on both domestic action and cooperation." }],
    evaluation: [{ criterion: "Effectiveness", assessment: recommendation, note: "Score " + Math.round(score) + "/100 against the selected priority." }, { criterion: "Efficiency", assessment: "Trade-off", note: "Compare output, consumer welfare, firm profit, and emissions together." }, { criterion: "Equity", assessment: "Mixed", note: "Stakeholder panel identifies who may gain or lose in the stylised scenario." }, { criterion: "Fiscal cost", assessment: i.governmentRevenue >= 100 ? "Capacity" : "Pressure", note: "Government revenue index is " + i.governmentRevenue + "." }, { criterion: "Feasibility", assessment: "Outside model", note: "Political, administrative, and enforcement capacity require additional evidence." }, { criterion: "Model limitation", assessment: "Important", note: "No result is a real-world forecast or universal recommendation." }],
  };
}

function chain(parameter: string, response: string, immediate: string, behaviour: string, outcome: string, consequence: string): MechanismStep[] {
  return [{ stage: "Policy design", text: parameter }, { stage: "Transmission", text: response }, { stage: "Immediate result", text: immediate }, { stage: "Behavioural channel", text: behaviour }, { stage: "Objective check", text: outcome }, { stage: "Recommendation", text: consequence }];
}
function clamp(value: number) { return Math.round(Math.max(0, Math.min(100, value))); }
