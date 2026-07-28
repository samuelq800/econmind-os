"use client";

import { useMemo } from "react";
import { Activity, BadgeDollarSign, ChartNoAxesCombined, CircleDollarSign, Gauge, Scale, Target, Users } from "lucide-react";
import { CartesianGrid, Legend, Line, LineChart, ReferenceDot, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartContainer } from "@/components/models/chart-container";
import { EconomicEvaluation, type EvaluationItem } from "@/components/models/economic-evaluation";
import { EconomicExplanation } from "@/components/models/economic-explanation";
import { EquationView } from "@/components/models/equation-view";
import { MechanismChain } from "@/components/models/mechanism-chain";
import { MetricCard } from "@/components/models/metric-card";
import { ModelAssumptions } from "@/components/models/model-assumptions";
import { ModelHeader } from "@/components/models/model-header";
import { ModelWorkspace } from "@/components/models/model-workspace";
import { ParameterControl } from "@/components/models/parameter-control";
import { ScenarioComparison } from "@/components/models/scenario-comparison";
import { ShortRunLongRun } from "@/components/models/short-run-long-run";
import { StakeholderImpact, type StakeholderImpactItem } from "@/components/models/stakeholder-impact";
import type { EquationStep, ModelParameter } from "@/lib/economics/types";
import { calculateIsLm, DEFAULT_IS_LM, isLmChartData, isLmEquationSteps, type IsLmParameters } from "@/lib/economics/is-lm";
import { analyzePrisonersDilemma, DEFAULT_PRISONERS_DILEMMA, DEFAULT_REPEATED_GAME, simulateRepeatedGame, type PrisonersDilemmaParameters, type RepeatedGameParameters, type Strategy } from "@/lib/economics/game-theory";
import { calculateCournot, cournotChartData, DEFAULT_COURNOT, type CournotParameters } from "@/lib/economics/cournot";
import { calculatePhillips, DEFAULT_PHILLIPS, phillipsChartData, type PhillipsParameters } from "@/lib/economics/phillips";
import { calculateSolow, DEFAULT_SOLOW, solowDiagramData, type SolowParameters } from "@/lib/economics/solow";
import { calculateLorenz, DEFAULT_LORENZ, type LorenzParameters } from "@/lib/economics/lorenz";
import { usePersistentState } from "@/lib/hooks/use-persistent-state";
import { useRecentParameter } from "@/lib/hooks/use-recent-parameter";
import type { AssumptionSections } from "@/lib/models/assumptions";
import type { MechanismStep } from "@/lib/models/explanations";
import type { ModelKey } from "@/lib/supabase/data";

export type NewLabKey = "is-lm" | "prisoners-dilemma" | "repeated-games" | "cournot" | "phillips-curve" | "solow-growth" | "lorenz-gini";
type Value = number | string;
type Values = Record<string, Value>;
type ChartLine = { key: string; label: string; color: string; dashed?: boolean };

const assumptions: Record<NewLabKey, AssumptionSections> = {
  "is-lm": {
    structural: ["Closed-economy goods and money markets clear simultaneously.", "Consumption, investment, and money demand are linear over the displayed range."],
    parameters: ["Money supply and the price level determine real money balances.", "Government spending and taxation shift autonomous demand."],
    limitations: ["This model cannot forecast output or interest rates.", "It omits exchange rates, expectations, banks, and adjustment lags."],
  },
  "prisoners-dilemma": {
    structural: ["Two players choose simultaneously with complete knowledge of the payoff matrix.", "Each player maximizes the numerical payoff shown."],
    parameters: ["Rows are Player A actions; columns are Player B actions.", "Best responses are recomputed after every payoff edit."],
    limitations: ["The matrix cannot infer real preferences, communication, or social norms.", "A Nash equilibrium is not necessarily efficient or fair."],
  },
  "repeated-games": {
    structural: ["Two players repeat a stylized strategic interaction for a finite number of rounds.", "Strategies follow deterministic rules; mistakes use a reproducible sequence."],
    parameters: ["The effective future weight equals discount factor × interaction probability.", "Payoffs are teaching values, not measurements."],
    limitations: ["No strategy is universally optimal across all environments.", "The model excludes learning, communication, and institutional detail."],
  },
  cournot: {
    structural: ["Two firms choose quantities simultaneously under linear inverse demand.", "Each firm has a constant marginal cost."],
    parameters: ["Current quantities can differ from best responses and equilibrium quantities.", "The competitive comparison allocates production to the lower-cost firm."],
    limitations: ["The model excludes capacity constraints, product differentiation, and repeated interaction.", "It does not estimate market power in a real industry."],
  },
  "phillips-curve": {
    structural: ["The short-run relationship is π = πe − α(u − un) + v.", "The long-run reference is the natural unemployment rate."],
    parameters: ["Expected inflation and supply shocks shift the SRPC.", "Unemployment changes move the point along a given SRPC."],
    limitations: ["This stylized curve cannot forecast inflation or unemployment.", "It omits wage setting, credibility, and policy lags."],
  },
  "solow-growth": {
    structural: ["Output per effective worker follows y = Ak^α.", "Savings finance investment and capital depreciates at a constant rate."],
    parameters: ["Population, technology, and depreciation create break-even investment.", "The transition is a deterministic discrete approximation."],
    limitations: ["This model cannot predict a country's growth rate.", "It excludes institutions, human capital, trade, and inequality."],
  },
  "lorenz-gini": {
    structural: ["Five editable values represent equal-sized population quintiles.", "Taxes and transfers are stylized arithmetic rules."],
    parameters: ["The Gini uses a discrete Lorenz-curve trapezoid approximation.", "Transfers are applied equally before minimum-income support."],
    limitations: ["The model cannot measure real household welfare or behavioural tax responses.", "It excludes public-service benefits and administrative costs."],
  },
};

const labels: Record<NewLabKey, { eyebrow: string; title: string; description: string; tags: string[]; difficulty: string }> = {
  "is-lm": { eyebrow: "Macroeconomics · Linked markets", title: "IS–LM", description: "Solve a transparent goods-and-money-market equilibrium, then inspect fiscal and monetary transmission.", tags: ["IS curve", "LM curve", "Crowding out"], difficulty: "Advanced" },
  "prisoners-dilemma": { eyebrow: "Strategic interaction · Simultaneous game", title: "Prisoner’s Dilemma", description: "Edit both players’ payoffs and see best responses, dominance, Nash equilibria, and efficiency update live.", tags: ["Payoffs", "Nash equilibrium", "Pareto efficiency"], difficulty: "Intermediate" },
  "repeated-games": { eyebrow: "Strategic interaction · Dynamic game", title: "Repeated Games", description: "Compare simple strategies across repeated interactions without claiming one strategy always wins.", tags: ["Cooperation", "Discounting", "Strategies"], difficulty: "Advanced" },
  cournot: { eyebrow: "Strategic interaction · Oligopoly", title: "Cournot Competition", description: "Move two firms’ quantities and compare the current outcome with best responses and Cournot–Nash equilibrium.", tags: ["Best response", "Oligopoly", "Welfare"], difficulty: "Advanced" },
  "phillips-curve": { eyebrow: "Macroeconomics · Inflation and employment", title: "Phillips Curve", description: "Separate movements along a short-run Phillips curve from shifts driven by expectations or supply shocks.", tags: ["Inflation", "Unemployment", "Expectations"], difficulty: "Intermediate" },
  "solow-growth": { eyebrow: "Macroeconomics · Long-run development", title: "Solow Growth Model", description: "Trace capital accumulation, steady states, and the distinction between level effects and transitional growth.", tags: ["Savings", "Steady state", "Golden Rule"], difficulty: "Advanced" },
  "lorenz-gini": { eyebrow: "Macroeconomics · Distribution", title: "Lorenz Curve & Gini Coefficient", description: "Change a five-quintile distribution and compare the inequality and fiscal effects of simple redistributive rules.", tags: ["Inequality", "Redistribution", "Gini"], difficulty: "Intermediate" },
};

const numericControls: Record<NewLabKey, ModelParameter[]> = {
  "is-lm": [
    { id: "autonomousConsumption", label: "Autonomous consumption", symbol: "C0", description: "Consumption independent of current disposable income.", min: 5, max: 80, step: 5, defaultValue: DEFAULT_IS_LM.autonomousConsumption },
    { id: "marginalPropensityToConsume", label: "Marginal propensity to consume", symbol: "c", description: "Share of an extra unit of disposable income spent.", min: 0.1, max: 0.9, step: 0.05, defaultValue: DEFAULT_IS_LM.marginalPropensityToConsume },
    { id: "taxation", label: "Taxation", symbol: "T", description: "Lump-sum tax in the simplified consumption function.", min: 0, max: 70, step: 5, defaultValue: DEFAULT_IS_LM.taxation },
    { id: "governmentSpending", label: "Government spending", symbol: "G", description: "Exogenous government demand.", min: 0, max: 90, step: 5, defaultValue: DEFAULT_IS_LM.governmentSpending },
    { id: "autonomousInvestment", label: "Autonomous investment", symbol: "I0", description: "Investment before the interest-rate response.", min: 5, max: 80, step: 5, defaultValue: DEFAULT_IS_LM.autonomousInvestment },
    { id: "investmentSensitivity", label: "Investment sensitivity", symbol: "b", description: "How strongly investment responds to interest rates.", min: 1, max: 20, step: 1, defaultValue: DEFAULT_IS_LM.investmentSensitivity },
    { id: "moneySupply", label: "Nominal money supply", symbol: "M", description: "Nominal money stock.", min: 20, max: 180, step: 10, defaultValue: DEFAULT_IS_LM.moneySupply },
    { id: "priceLevel", label: "Price level", symbol: "P", description: "Converts nominal money into real balances.", min: 0.5, max: 3, step: 0.1, defaultValue: DEFAULT_IS_LM.priceLevel },
    { id: "incomeMoneySensitivity", label: "Income sensitivity of money demand", symbol: "k", description: "How money demand rises with output.", min: 0.1, max: 1.5, step: 0.05, defaultValue: DEFAULT_IS_LM.incomeMoneySensitivity },
    { id: "interestMoneySensitivity", label: "Interest sensitivity of money demand", symbol: "h", description: "How money demand falls with the interest rate.", min: 2, max: 30, step: 1, defaultValue: DEFAULT_IS_LM.interestMoneySensitivity },
  ],
  "prisoners-dilemma": [
    { id: "ccA", label: "A payoff: cooperate / cooperate", symbol: "CC A", description: "Player A payoff when both cooperate.", min: -5, max: 10, step: 1, defaultValue: 3 },
    { id: "ccB", label: "B payoff: cooperate / cooperate", symbol: "CC B", description: "Player B payoff when both cooperate.", min: -5, max: 10, step: 1, defaultValue: 3 },
    { id: "cdA", label: "A payoff: cooperate / defect", symbol: "CD A", description: "Player A payoff when A cooperates and B defects.", min: -5, max: 10, step: 1, defaultValue: 0 },
    { id: "cdB", label: "B payoff: cooperate / defect", symbol: "CD B", description: "Player B payoff when A cooperates and B defects.", min: -5, max: 10, step: 1, defaultValue: 5 },
    { id: "dcA", label: "A payoff: defect / cooperate", symbol: "DC A", description: "Player A payoff when A defects and B cooperates.", min: -5, max: 10, step: 1, defaultValue: 5 },
    { id: "dcB", label: "B payoff: defect / cooperate", symbol: "DC B", description: "Player B payoff when A defects and B cooperates.", min: -5, max: 10, step: 1, defaultValue: 0 },
    { id: "ddA", label: "A payoff: defect / defect", symbol: "DD A", description: "Player A payoff when both defect.", min: -5, max: 10, step: 1, defaultValue: 1 },
    { id: "ddB", label: "B payoff: defect / defect", symbol: "DD B", description: "Player B payoff when both defect.", min: -5, max: 10, step: 1, defaultValue: 1 },
  ],
  "repeated-games": [
    { id: "rounds", label: "Number of rounds", symbol: "T", description: "How many repeated interactions are displayed.", min: 2, max: 50, step: 1, defaultValue: DEFAULT_REPEATED_GAME.rounds },
    { id: "discountFactor", label: "Discount factor", symbol: "δ", description: "How much future payoffs matter.", min: 0, max: 1, step: 0.05, defaultValue: DEFAULT_REPEATED_GAME.discountFactor },
    { id: "futureInteractionProbability", label: "Future interaction probability", symbol: "p", description: "Probability weight placed on future encounters.", min: 0, max: 1, step: 0.05, defaultValue: DEFAULT_REPEATED_GAME.futureInteractionProbability },
    { id: "mistakeProbability", label: "Mistake probability", symbol: "ε", description: "A deterministic simulation of occasional action errors.", min: 0, max: 0.4, step: 0.02, defaultValue: DEFAULT_REPEATED_GAME.mistakeProbability },
  ],
  cournot: [
    { id: "demandIntercept", label: "Demand intercept", symbol: "a", description: "Choke price in P = a − bQ.", min: 40, max: 180, step: 5, defaultValue: DEFAULT_COURNOT.demandIntercept },
    { id: "demandSlope", label: "Demand slope", symbol: "b", description: "Price reduction per additional unit of total output.", min: 0.25, max: 3, step: 0.25, defaultValue: DEFAULT_COURNOT.demandSlope },
    { id: "marginalCost1", label: "Firm 1 marginal cost", symbol: "c1", description: "Constant cost of one extra unit for Firm 1.", min: 0, max: 70, step: 5, defaultValue: DEFAULT_COURNOT.marginalCost1 },
    { id: "marginalCost2", label: "Firm 2 marginal cost", symbol: "c2", description: "Constant cost of one extra unit for Firm 2.", min: 0, max: 70, step: 5, defaultValue: DEFAULT_COURNOT.marginalCost2 },
    { id: "quantity1", label: "Firm 1 quantity", symbol: "q1", description: "Current output choice for Firm 1.", min: 0, max: 100, step: 1, defaultValue: DEFAULT_COURNOT.quantity1 },
    { id: "quantity2", label: "Firm 2 quantity", symbol: "q2", description: "Current output choice for Firm 2.", min: 0, max: 100, step: 1, defaultValue: DEFAULT_COURNOT.quantity2 },
  ],
  "phillips-curve": [
    { id: "expectedInflation", label: "Expected inflation", symbol: "πe", description: "Expected inflation shifts the short-run curve.", min: -2, max: 12, step: 0.5, defaultValue: DEFAULT_PHILLIPS.expectedInflation },
    { id: "unemployment", label: "Actual unemployment", symbol: "u", description: "Current unemployment rate.", min: 0, max: 15, step: 0.5, defaultValue: DEFAULT_PHILLIPS.unemployment },
    { id: "naturalUnemployment", label: "Natural unemployment", symbol: "un", description: "Long-run unemployment reference point.", min: 2, max: 10, step: 0.5, defaultValue: DEFAULT_PHILLIPS.naturalUnemployment },
    { id: "sensitivity", label: "Curve sensitivity", symbol: "α", description: "Inflation response to an unemployment gap.", min: 0.2, max: 3, step: 0.1, defaultValue: DEFAULT_PHILLIPS.sensitivity },
    { id: "supplyShock", label: "Supply shock", symbol: "v", description: "Adverse shocks are positive inflation pressure.", min: -5, max: 8, step: 0.5, defaultValue: DEFAULT_PHILLIPS.supplyShock },
    { id: "demandPressure", label: "Demand pressure", symbol: "d", description: "A teaching link from demand conditions to inflation pressure.", min: -5, max: 8, step: 0.5, defaultValue: DEFAULT_PHILLIPS.demandPressure },
  ],
  "solow-growth": [
    { id: "savingsRate", label: "Savings rate", symbol: "s", description: "Share of output saved and invested.", min: 5, max: 70, step: 1, defaultValue: DEFAULT_SOLOW.savingsRate },
    { id: "populationGrowth", label: "Population growth", symbol: "n", description: "Dilutes capital per effective worker.", min: 0, max: 8, step: 0.5, defaultValue: DEFAULT_SOLOW.populationGrowth },
    { id: "technologyGrowth", label: "Technology growth", symbol: "g", description: "Raises break-even investment in effective-worker terms.", min: 0, max: 8, step: 0.5, defaultValue: DEFAULT_SOLOW.technologyGrowth },
    { id: "depreciation", label: "Depreciation", symbol: "δ", description: "Capital that wears out each period.", min: 0, max: 15, step: 0.5, defaultValue: DEFAULT_SOLOW.depreciation },
    { id: "capitalElasticity", label: "Capital elasticity", symbol: "α", description: "Capital exponent in the production function.", min: 0.1, max: 0.8, step: 0.05, defaultValue: DEFAULT_SOLOW.capitalElasticity },
    { id: "productivity", label: "Total factor productivity", symbol: "A", description: "Productivity level in y = Akα.", min: 0.4, max: 2.5, step: 0.1, defaultValue: DEFAULT_SOLOW.productivity },
    { id: "initialCapital", label: "Initial capital", symbol: "k0", description: "Starting capital per effective worker.", min: 1, max: 100, step: 1, defaultValue: DEFAULT_SOLOW.initialCapital },
  ],
  "lorenz-gini": [
    { id: "quintile1", label: "Lowest quintile income", symbol: "Q1", description: "Income index for the lowest 20%.", min: 0, max: 50, step: 1, defaultValue: DEFAULT_LORENZ.quintile1 },
    { id: "quintile2", label: "Second quintile income", symbol: "Q2", description: "Income index for the second 20%.", min: 0, max: 60, step: 1, defaultValue: DEFAULT_LORENZ.quintile2 },
    { id: "quintile3", label: "Middle quintile income", symbol: "Q3", description: "Income index for the middle 20%.", min: 0, max: 80, step: 1, defaultValue: DEFAULT_LORENZ.quintile3 },
    { id: "quintile4", label: "Fourth quintile income", symbol: "Q4", description: "Income index for the fourth 20%.", min: 0, max: 120, step: 1, defaultValue: DEFAULT_LORENZ.quintile4 },
    { id: "quintile5", label: "Highest quintile income", symbol: "Q5", description: "Income index for the highest 20%.", min: 0, max: 220, step: 2, defaultValue: DEFAULT_LORENZ.quintile5 },
    { id: "taxRate", label: "Tax rate", symbol: "τ", description: "Flat tax rate or average progressive rate.", min: 0, max: 55, step: 1, defaultValue: DEFAULT_LORENZ.taxRate },
    { id: "transfer", label: "Universal transfer", symbol: "B", description: "Transfer added to every quintile.", min: 0, max: 30, step: 1, defaultValue: DEFAULT_LORENZ.transfer },
    { id: "minimumIncome", label: "Minimum-income support", symbol: "M", description: "Income floor after tax and transfer.", min: 0, max: 40, step: 1, defaultValue: DEFAULT_LORENZ.minimumIncome },
  ],
};

function asNumbers(values: Values) {
  return Object.fromEntries(Object.entries(values).map(([key, value]) => [key, Number(value)])) as Record<string, number>;
}

function commonEvaluation(): EvaluationItem[] {
  return [
    { criterion: "Effectiveness", assessment: "Conditional", note: "The displayed outcome follows the model’s stated mechanism and current parameters." },
    { criterion: "Efficiency", assessment: "Trade-off", note: "Use the live welfare, output, payoff, or inequality metrics rather than relying on one headline result." },
    { criterion: "Equity", assessment: "Context needed", note: "Distributional consequences depend on stakeholders and are not fully captured by aggregate indices." },
    { criterion: "Administrative feasibility", assessment: "Outside model", note: "Implementation, enforcement, and information costs are not estimated here." },
    { criterion: "Long run", assessment: "Stylised", note: "Long-run adjustments are educational mechanisms, not empirical forecasts." },
    { criterion: "Model limitation", assessment: "Important", note: "Changing an assumption can change the conclusion; inspect the assumptions panel before drawing a judgement." },
  ];
}

export function NewModelLab({ model }: { model: NewLabKey }) {
  const initial = useMemo<Values>(() => ({ ...(model === "is-lm" ? DEFAULT_IS_LM : model === "prisoners-dilemma" ? DEFAULT_PRISONERS_DILEMMA : model === "repeated-games" ? DEFAULT_REPEATED_GAME : model === "cournot" ? DEFAULT_COURNOT : model === "phillips-curve" ? DEFAULT_PHILLIPS : model === "solow-growth" ? DEFAULT_SOLOW : DEFAULT_LORENZ) }), [model]);
  const [values, setValues] = usePersistentState<Values>("econmind:parameters:" + model, initial);
  const update = (key: string, value: Value) => setValues((current) => ({ ...current, [key]: value }));
  const definition = buildDefinition(model, values);
  const lastChanged = useRecentParameter(values);
  if (lastChanged) {
    definition.mechanism[0] = { stage: "Latest parameter change", text: lastChanged + " changed. The live model recalculates the affected relationship below." };
    definition.equations[0] = { ...definition.equations[0], affectedTerms: [lastChanged] };
  }
  const info = labels[model];
  const supportsComparison = ["is-lm", "cournot", "phillips-curve", "solow-growth", "lorenz-gini"].includes(model);

  return <>
    <ModelHeader modelKey={model as ModelKey} eyebrow={info.eyebrow} title={info.title} description={info.description} difficulty={info.difficulty} tags={info.tags} />
    <ModelWorkspace
      onReset={() => setValues(initial)}
      controls={<>
        {numericControls[model].map((control) => <ParameterControl key={control.id} parameter={control} value={Number(values[control.id])} onChange={(value) => update(control.id, value)} />)}
        {model === "repeated-games" && <StrategyControls values={values} update={update} />}
        {model === "lorenz-gini" && <TaxSystemControl value={String(values.taxSystem)} update={update} />}
      </>}
      chart={<LabVisual model={model} definition={definition} />}
      metrics={<>{definition.metrics.map((metric) => <MetricCard key={metric.label} label={metric.label} value={metric.value} note={metric.note} icon={metric.icon} tone={metric.tone} />)}</>}
      explanation={<>
        <EconomicExplanation principle={definition.principle} modelLabel={info.title}>{definition.interpretation}</EconomicExplanation>
        <MechanismChain steps={definition.mechanism} modelLabel={info.title} />
        <EquationView steps={definition.equations} modelLabel={info.title} />
        <ModelAssumptions assumptions={assumptions[model]} modelLabel={info.title} />
        <StakeholderImpact items={definition.stakeholders} modelLabel={info.title} />
        {definition.shortRun && <ShortRunLongRun {...definition.shortRun} modelLabel={info.title} />}
        <EconomicEvaluation items={commonEvaluation()} modelLabel={info.title} />
      </>}
      comparison={supportsComparison ? <ScenarioComparison storageKey={"econmind:scenarios:" + model} modelKey={model as ModelKey} parameters={asNumbers(values)} results={definition.results} metrics={Object.keys(definition.results).slice(0, 6)} onLoadParameters={(saved) => setValues((current) => ({ ...current, ...saved }))} /> : <></>}
    />
  </>;
}

type Definition = {
  interpretation: string; principle: string; metrics: Array<{ label: string; value: string | number; note: string; icon: typeof Activity; tone: "neutral" | "green" | "amber" | "red" | "blue" }>;
  mechanism: MechanismStep[]; equations: EquationStep[]; stakeholders: StakeholderImpactItem[]; results: Record<string, number>;
  chart: { title: string; subtitle: string; data?: Array<Record<string, number | string>>; x?: string; lines?: ChartLine[]; dot?: { x: number; y: number }; matrix?: ReturnType<typeof analyzePrisonersDilemma>["cells"] };
  shortRun?: { shortRun: string; longRun: string };
};

function buildDefinition(model: NewLabKey, values: Values): Definition {
  const n = asNumbers(values);
  if (model === "is-lm") {
    const p = n as IsLmParameters; const out = calculateIsLm(p);
    return {
      interpretation: "The IS and LM curves intersect at a joint goods-and-money-market equilibrium. A higher government spending value shifts autonomous demand, while a higher money supply raises real balances and shifts the LM relationship.",
      principle: "Fiscal policy raises demand but can raise interest rates and partly displace interest-sensitive investment; monetary conditions change the interest rate through real money balances.",
      metrics: [{ label: "Equilibrium output", value: out.output, note: "Goods and money markets clear", icon: Activity, tone: "blue" }, { label: "Interest rate", value: out.interestRate, note: "Money-market equilibrium", icon: Gauge, tone: "amber" }, { label: "Consumption", value: out.consumption, note: "C0 + c(Y − T)", icon: CircleDollarSign, tone: "green" }, { label: "Investment", value: out.investment, note: "I0 − bi", icon: ChartNoAxesCombined, tone: "blue" }, { label: "Fiscal multiplier", value: out.fiscalMultiplier, note: "With money-market feedback", icon: Scale, tone: "amber" }, { label: "Crowding out", value: out.crowdingOut, note: "Simplified interest-rate channel", icon: Target, tone: "red" }],
      mechanism: chain("A policy or behavioural parameter changes.", "IS or LM shifts / rotates according to its equation.", "At the prior interest rate, planned saving-investment or money demand no longer clears.", "Output and the interest rate adjust together.", "Equilibrium is Y = " + out.output + " and i = " + out.interestRate + ".", "Investment is " + out.investment + "; fiscal crowding out is shown as a stylised channel."),
      equations: isLmEquationSteps(p),
      stakeholders: [{ stakeholder: "Households", direction: "Mixed", shortRun: "Output and disposable income move with the new equilibrium.", equity: "Distribution is not modelled.", reason: "Consumption responds to output and taxation." }, { stakeholder: "Firms", direction: out.investment >= p.autonomousInvestment ? "Gains" : "Loses", magnitude: "Investment " + out.investment, shortRun: "Interest rates change financing conditions.", longRun: "Capacity effects are outside this static model.", reason: "Investment falls when i rises." }, { stakeholder: "Government", direction: "Mixed", shortRun: "Spending and taxes shift aggregate demand.", reason: "The model does not calculate a public budget balance." }],
      results: { output: out.output, interestRate: out.interestRate, consumption: out.consumption, investment: out.investment, fiscalMultiplier: out.fiscalMultiplier, crowdingOut: out.crowdingOut },
      chart: { title: "IS–LM equilibrium", subtitle: "Separate, synchronised goods and money market curves. Values are educational indices.", data: isLmChartData(p), x: "output", lines: [{ key: "is", label: "IS", color: "var(--blue)" }, { key: "lm", label: "LM", color: "var(--accent)" }], dot: { x: out.output, y: out.interestRate } },
    };
  }
  if (model === "prisoners-dilemma") {
    const p = n as PrisonersDilemmaParameters; const out = analyzePrisonersDilemma(p);
    return {
      interpretation: out.socialDilemma ? "Private incentives make defection strictly dominant for both players, even though mutual cooperation creates higher joint payoff." : "The edited matrix no longer has all standard Prisoner’s Dilemma conditions. Read the highlighted best responses before naming the strategic problem.",
      principle: "A Nash equilibrium is a cell where neither player can gain by changing action unilaterally; it need not maximize joint welfare.",
      metrics: [{ label: "Pure Nash equilibria", value: out.nash.join(", ") || "None", note: "Mutual best responses", icon: Target, tone: "amber" }, { label: "A dominant action", value: out.aStrictDominant.join(", ") || "None", note: "Strict dominance", icon: Users, tone: "blue" }, { label: "B dominant action", value: out.bStrictDominant.join(", ") || "None", note: "Strict dominance", icon: Users, tone: "blue" }, { label: "Pareto cells", value: out.pareto.join(", "), note: "Not jointly dominated", icon: Scale, tone: "green" }, { label: "Joint-payoff maximum", value: out.jointMaximum.join(", "), note: "Highest sum of payoffs", icon: BadgeDollarSign, tone: "green" }, { label: "Social dilemma", value: out.socialDilemma ? "Yes" : "No", note: "Standard PD test", icon: Activity, tone: out.socialDilemma ? "red" : "neutral" }],
      mechanism: chain("A payoff is edited.", "Each player recalculates the action that maximizes their own payoff for each opponent action.", "Best-response cells are highlighted.", "Mutual best responses form Nash equilibria.", "Current pure equilibria: " + (out.nash.join(", ") || "none") + ".", out.socialDilemma ? "Private incentives conflict with the higher joint payoff from cooperation." : "Efficiency and equilibrium do not automatically coincide."),
      equations: [{ label: "Best response", expression: "BR_A(b) = arg max_a u_A(a, b); BR_B(a) = arg max_b u_B(a, b)" }, { label: "Nash condition", expression: "(a*, b*) is Nash when a* ∈ BR_A(b*) and b* ∈ BR_B(a*)" }, { label: "Current equilibria", expression: "Pure Nash cells = " + (out.nash.join(", ") || "∅") }, { label: "Pareto test", expression: "A cell is Pareto efficient when no other cell weakly improves both payoffs and strictly improves one." }],
      stakeholders: [{ stakeholder: "Player A", direction: "Depends", shortRun: "Chooses the highlighted best response to B’s action.", reason: "Payoffs are directly edited by the learner." }, { stakeholder: "Player B", direction: "Depends", shortRun: "Chooses the highlighted best response to A’s action.", reason: "Payoffs are directly edited by the learner." }, { stakeholder: "Joint welfare", direction: out.socialDilemma ? "Loses" : "Mixed", shortRun: "Compare Nash cells with the joint-payoff maximum.", equity: "Symmetry depends on the two payoff columns.", reason: "Individual incentives can diverge from collective payoff." }],
      results: { nashCount: out.nash.length, paretoCount: out.pareto.length, socialDilemma: out.socialDilemma ? 1 : 0 },
      chart: { title: "Live payoff matrix", subtitle: "Gold marks mutual best responses; green marks Pareto-efficient cells. Border labels identify each player’s best response.", matrix: out.cells },
    };
  }
  if (model === "repeated-games") {
    const p = { ...DEFAULT_REPEATED_GAME, ...n, strategyA: values.strategyA as Strategy, strategyB: values.strategyB as Strategy } as RepeatedGameParameters;
    const out = simulateRepeatedGame(p);
    return {
      interpretation: "Repeated interaction makes future consequences relevant, but the result depends on the selected strategies, the future weight, and the deterministic mistake sequence.",
      principle: "Strategies can sustain cooperation when future losses from punishment outweigh the one-period gain from defection; this is not a universal result.",
      metrics: [{ label: "A cumulative payoff", value: out.cumulativeA, note: "Undiscounted", icon: BadgeDollarSign, tone: "blue" }, { label: "B cumulative payoff", value: out.cumulativeB, note: "Undiscounted", icon: BadgeDollarSign, tone: "green" }, { label: "Cooperation rate", value: out.cooperationRate + "%", note: "Mutual cooperation rounds", icon: Users, tone: "green" }, { label: "Defection rate", value: out.defectionRate + "%", note: "At least one defection", icon: Activity, tone: "red" }, { label: "Punishment periods", value: out.punishmentPeriods, note: "Mutual defection", icon: Target, tone: "amber" }, { label: "Final winner", value: out.winner, note: "Within this strategy pair", icon: Scale, tone: "neutral" }],
      mechanism: chain("Strategies, future weight, or noise changes.", "Each strategy maps prior actions into the next move.", "A mistake can trigger retaliation under contingent strategies.", "Future payoffs are discounted by δ × p.", "Cooperation is " + out.cooperationRate + "% over " + out.rounds.length + " rounds.", "The displayed winner is conditional on these rules, not a universal ranking."),
      equations: [{ label: "Effective future weight", expression: "β = δ × p = " + p.discountFactor + " × " + p.futureInteractionProbability + " = " + (p.discountFactor * p.futureInteractionProbability).toFixed(2) }, { label: "Discounted payoff", expression: "V_i = Σ β^(t−1) u_i,t" }, { label: "Current strategies", expression: "A: " + p.strategyA + "; B: " + p.strategyB }, { label: "Outcome", expression: "V_A = " + out.discountedA + "; V_B = " + out.discountedB }],
      stakeholders: [{ stakeholder: "Player A", direction: out.cumulativeA >= out.cumulativeB ? "Gains" : "Loses", shortRun: "Follows " + p.strategyA + ".", reason: "Payoff depends on the sequence of mutual actions." }, { stakeholder: "Player B", direction: out.cumulativeB >= out.cumulativeA ? "Gains" : "Loses", shortRun: "Follows " + p.strategyB + ".", reason: "Payoff depends on the sequence of mutual actions." }, { stakeholder: "Relationship", direction: out.cooperationRate >= 50 ? "Gains" : "Loses", shortRun: "Mutual cooperation rate is " + out.cooperationRate + "%.", longRun: "Trust, learning, and communication are outside the model.", reason: "Contingent strategies respond to observed actions." }],
      results: { cumulativeA: out.cumulativeA, cumulativeB: out.cumulativeB, cooperationRate: out.cooperationRate, defectionRate: out.defectionRate },
      chart: { title: "Repeated-game timeline", subtitle: "Cumulative payoffs by round for the selected deterministic strategy pair.", data: out.rounds.map((row) => ({ round: row.round, playerA: row.cumulativeA, playerB: row.cumulativeB })), x: "round", lines: [{ key: "playerA", label: "Player A", color: "var(--blue)" }, { key: "playerB", label: "Player B", color: "var(--accent)" }] },
    };
  }
  if (model === "cournot") {
    const p = n as CournotParameters; const out = calculateCournot(p);
    return {
      interpretation: "Each firm’s best response falls as its rival supplies more. The current point need not be a Cournot–Nash equilibrium until both firms are simultaneously best responding.",
      principle: "In Cournot competition, each firm chooses output anticipating the price effect of total industry quantity.",
      metrics: [{ label: "Market price", value: out.price, note: "P = a − b(q1 + q2)", icon: CircleDollarSign, tone: "amber" }, { label: "Total output", value: out.totalOutput, note: "Current quantity pair", icon: Activity, tone: "blue" }, { label: "Firm 1 profit", value: out.profit1, note: "Current q1", icon: BadgeDollarSign, tone: "green" }, { label: "Firm 2 profit", value: out.profit2, note: "Current q2", icon: BadgeDollarSign, tone: "green" }, { label: "Cournot–Nash", value: out.equilibriumTotal, note: "Total equilibrium output", icon: Target, tone: "amber" }, { label: "Deadweight loss", value: out.deadweightLoss, note: "vs low-cost competitive benchmark", icon: Scale, tone: "red" }],
      mechanism: chain("One firm changes output or cost.", "The rival’s best-response curve shifts or a point moves along it.", "Total quantity changes the market price.", "Each firm compares marginal revenue with marginal cost.", "Current price is " + out.price + "; Nash quantities are (" + out.equilibrium1 + ", " + out.equilibrium2 + ").", "Consumer surplus is " + out.consumerSurplus + " and modelled welfare loss is " + out.deadweightLoss + "."),
      equations: [{ label: "Inverse demand", expression: "P = a − b(q1 + q2) = " + p.demandIntercept + " − " + p.demandSlope + "(q1 + q2)" }, { label: "Firm profit", expression: "πi = (P − ci)qi" }, { label: "Best response 1", expression: "BR1(q2) = (a − c1 − bq2)/(2b) = " + out.bestResponse1 }, { label: "Best response 2", expression: "BR2(q1) = (a − c2 − bq1)/(2b) = " + out.bestResponse2 }, { label: "Cournot–Nash", expression: "(q1*, q2*) = (" + out.equilibrium1 + ", " + out.equilibrium2 + "); P* = " + out.equilibriumPrice }],
      stakeholders: [{ stakeholder: "Consumers", direction: out.price < p.demandIntercept / 2 ? "Gains" : "Mixed", shortRun: "Lower total output raises the market price.", reason: "Consumer surplus is " + out.consumerSurplus + "." }, { stakeholder: "Firm 1", direction: out.profit1 >= 0 ? "Gains" : "Loses", magnitude: "Profit " + out.profit1, shortRun: "Can move q1 toward its best response of " + out.bestResponse1 + ".", reason: "Output changes both price and revenue." }, { stakeholder: "Firm 2", direction: out.profit2 >= 0 ? "Gains" : "Loses", magnitude: "Profit " + out.profit2, shortRun: "Can move q2 toward its best response of " + out.bestResponse2 + ".", reason: "Output changes both price and revenue." }],
      results: { price: out.price, totalOutput: out.totalOutput, profit1: out.profit1, profit2: out.profit2, equilibriumTotal: out.equilibriumTotal, deadweightLoss: out.deadweightLoss },
      chart: { title: "Best-response curves", subtitle: "A mutual best response is the Cournot–Nash point; the dot is the current quantity pair.", data: cournotChartData(p).map((row) => ({ quantity1: row.quantity1, firm1: row.responseOfFirm1, firm2: row.responseOfFirm2 })), x: "quantity1", lines: [{ key: "firm1", label: "Firm 1 best response (q2)", color: "var(--blue)" }, { key: "firm2", label: "Firm 2 best response (q1)", color: "var(--accent)" }], dot: { x: p.quantity1, y: p.quantity2 } },
    };
  }
  if (model === "phillips-curve") {
    const p = n as PhillipsParameters; const out = calculatePhillips(p);
    return {
      interpretation: out.movement + ": current inflation is generated from expected inflation, the unemployment gap, supply shock, and the teaching demand-pressure term.",
      principle: "The short-run inflation–unemployment trade-off is not a permanent long-run trade-off in this stylised expectations-augmented model.",
      metrics: [{ label: "Inflation", value: out.inflation + "%", note: "Current SRPC outcome", icon: Gauge, tone: out.inflation > p.expectedInflation ? "red" : "blue" }, { label: "Unemployment gap", value: out.unemploymentGap + "pp", note: out.shortRunPosition, icon: Users, tone: out.unemploymentGap > 0 ? "red" : "green" }, { label: "Inflation surprise", value: out.inflationSurprise + "pp", note: "π − πe", icon: Activity, tone: "amber" }, { label: "SRPC status", value: out.movement, note: "Move or shift", icon: Target, tone: "blue" }, { label: "LRPC reference", value: p.naturalUnemployment + "%", note: "Natural unemployment", icon: Scale, tone: "neutral" }],
      mechanism: chain("Inflation expectations, unemployment, or shocks change.", p.supplyShock !== 0 ? "A supply shock shifts the SRPC." : p.expectedInflation !== DEFAULT_PHILLIPS.expectedInflation ? "Expected inflation shifts the SRPC." : "The point moves along the current SRPC.", "Inflation pressure changes relative to expected inflation.", "Wage and price setting are represented only by the stylised equation.", "Inflation is " + out.inflation + "% at unemployment " + p.unemployment + "%.", "In the long run, the model references unemployment " + p.naturalUnemployment + "% rather than a permanent trade-off."),
      equations: [{ label: "Short-run Phillips curve", expression: "π = πe − α(u − un) + v + d" }, { label: "Current substitution", expression: "π = " + p.expectedInflation + " − " + p.sensitivity + "(" + p.unemployment + " − " + p.naturalUnemployment + ") + " + p.supplyShock + " + " + p.demandPressure }, { label: "Inflation", expression: "π = " + out.inflation + "%" }, { label: "Long-run reference", expression: "LRPC: u = un = " + p.naturalUnemployment + "%" }],
      stakeholders: [{ stakeholder: "Workers", direction: p.unemployment <= p.naturalUnemployment ? "Gains" : "Loses", shortRun: out.shortRunPosition, longRun: "Natural unemployment is a model reference, not a welfare judgement.", reason: "The output/labour link is reduced to unemployment." }, { stakeholder: "Households", direction: out.inflation > p.expectedInflation ? "Loses" : "Mixed", shortRun: "Unexpected inflation affects purchasing power in ways not individually modelled.", reason: "Inflation surprise is " + out.inflationSurprise + "pp." }, { stakeholder: "Policymakers", direction: "Mixed", shortRun: "Face a trade-off within the SRPC.", reason: "Supply shocks can worsen inflation and unemployment together." }],
      results: { inflation: out.inflation, unemploymentGap: out.unemploymentGap, inflationSurprise: out.inflationSurprise },
      chart: { title: "Short-run and long-run Phillips curve", subtitle: "The vertical reference is the natural unemployment rate. Curves use stylised percentage values.", data: phillipsChartData(p), x: "unemployment", lines: [{ key: "baseline", label: "Baseline SRPC", color: "var(--blue)", dashed: true }, { key: "srpc", label: "Current SRPC", color: "var(--accent)" }], dot: { x: p.unemployment, y: out.inflation } },
      shortRun: { shortRun: "With expectations and supply conditions fixed, a lower unemployment rate is associated with higher inflation in the displayed SRPC.", longRun: "This educational model labels the long-run curve at the natural unemployment rate. Expectations and institutions can adjust; no permanent inflation–unemployment trade-off is asserted." },
    };
  }
  if (model === "solow-growth") {
    const p = n as SolowParameters; const out = calculateSolow(p);
    return {
      interpretation: "Saving raises investment per effective worker. The economy moves toward the point where saving equals break-even investment; the transition path shows a deterministic educational approximation.",
      principle: "In the Solow model, changes in the savings rate alter long-run income levels, while sustained per-effective-worker growth requires technology in the stylised framework.",
      metrics: [{ label: "Current capital", value: out.capital, note: "Per effective worker", icon: ChartNoAxesCombined, tone: "blue" }, { label: "Current output", value: out.output, note: "y = Akα", icon: Activity, tone: "green" }, { label: "Current consumption", value: out.consumption, note: "Output minus saving", icon: CircleDollarSign, tone: "amber" }, { label: "Steady-state capital", value: out.steadyCapital, note: "s f(k) = break-even", icon: Target, tone: "green" }, { label: "Golden Rule saving", value: out.goldenRuleSavings + "%", note: "Cobb–Douglas benchmark", icon: Scale, tone: "amber" }, { label: "Transition speed", value: out.transitionSpeed, note: "First-period capital change", icon: Gauge, tone: "blue" }],
      mechanism: chain("A growth parameter changes.", "The saving curve, break-even line, or production function shifts.", "At current capital, investment differs from break-even investment.", "Capital per effective worker accumulates or decays.", "Steady-state capital is " + out.steadyCapital + " and output is " + out.steadyOutput + ".", "The model separates level effects from technology-driven long-run per-capita growth."),
      equations: [{ label: "Production", expression: "y = Ak^α = " + p.productivity + "k^" + p.capitalElasticity }, { label: "Capital accumulation", expression: "Δk = sf(k) − (n + g + δ)k" }, { label: "Current balance", expression: "Investment = " + out.investment + "; break-even = " + out.breakEven }, { label: "Steady state", expression: "k* = [sA/(n + g + δ)]^(1/(1 − α)) = " + out.steadyCapital }, { label: "Golden Rule", expression: "s_GR = α = " + out.goldenRuleSavings + "%" }],
      stakeholders: [{ stakeholder: "Current consumers", direction: "Mixed", shortRun: "Higher saving reduces current consumption for a given output.", reason: "Current consumption is " + out.consumption + "." }, { stakeholder: "Future workers", direction: out.steadyOutput >= out.output ? "Gains" : "Mixed", shortRun: "Benefit only as capital accumulates over time.", longRun: "Steady-state output is " + out.steadyOutput + " in this model.", reason: "Investment changes capital per effective worker." }, { stakeholder: "Economy", direction: "Depends", shortRun: "Transition speed is " + out.transitionSpeed + ".", reason: "Technology, depreciation, and population growth shape break-even investment." }],
      results: { capital: out.capital, output: out.output, consumption: out.consumption, steadyCapital: out.steadyCapital, steadyOutput: out.steadyOutput, goldenRuleSavings: out.goldenRuleSavings },
      chart: { title: "Solow diagram", subtitle: "Saving/investment and break-even investment; the transition path is available in the expanded view.", data: solowDiagramData(p).map((row) => ({ capital: row.capital, saving: row.saving, breakEven: row.breakEven })), x: "capital", lines: [{ key: "saving", label: "Saving / investment", color: "var(--accent)" }, { key: "breakEven", label: "Break-even investment", color: "var(--amber)", dashed: true }], dot: { x: out.steadyCapital, y: out.steadyInvestment } },
      shortRun: { shortRun: "A higher savings rate redirects part of current output from consumption to investment and changes the transition path.", longRun: "In this stylised model, a savings change raises the steady-state level of output per effective worker, not its permanent growth rate; technology drives the latter." },
    };
  }
  const p = { ...DEFAULT_LORENZ, ...n, taxSystem: values.taxSystem as "progressive" | "flat" } as LorenzParameters; const out = calculateLorenz(p);
  const lorenzData = out.prePoints.map((point, index) => ({ population: point.population, prePolicy: point.income, postPolicy: out.postPoints[index].income, equality: point.population }));
  return {
    interpretation: "The Lorenz curves show cumulative income shares for five equal population groups. The Gini coefficient is the discrete area between the equality line and each Lorenz curve.",
    principle: "Redistribution can reduce measured inequality, but fiscal cost, behavioural response, public-service value, and administrative feasibility are outside this arithmetic teaching model.",
    metrics: [{ label: "Pre-policy Gini", value: out.preGini, note: "Discrete Lorenz approximation", icon: ChartNoAxesCombined, tone: "red" }, { label: "Post-policy Gini", value: out.postGini, note: "After tax and transfer", icon: ChartNoAxesCombined, tone: "green" }, { label: "Inequality change", value: out.giniChange, note: "Negative means lower Gini", icon: Scale, tone: out.giniChange < 0 ? "green" : "red" }, { label: "Tax revenue", value: out.revenue, note: "Five quintile units", icon: BadgeDollarSign, tone: "blue" }, { label: "Transfer cost", value: out.transferCost, note: "Including support top-up", icon: CircleDollarSign, tone: "amber" }, { label: "Net fiscal impact", value: out.netFiscalImpact, note: "Revenue minus cost", icon: Target, tone: out.netFiscalImpact >= 0 ? "green" : "red" }],
    mechanism: chain("Income shares or policy rules change.", "Tax liabilities and transfers are recalculated for each quintile.", "Post-policy disposable incomes alter cumulative income shares.", "The Lorenz curve bends toward or away from equality.", "Gini changes from " + out.preGini + " to " + out.postGini + ".", "Net fiscal impact is " + out.netFiscalImpact + "; behavioural responses are not included."),
    equations: [{ label: "Tax rule", expression: p.taxSystem === "flat" ? "Tax_i = τ × income_i" : "Tax_i = τ × income_i × relative-income factor" }, { label: "Disposable income", expression: "y_i' = max(M, y_i − tax_i + B)" }, { label: "Lorenz point", expression: "L_j = cumulative income through group j / total income" }, { label: "Gini approximation", expression: "G = 1 − (1/n) Σ(L_(i−1) + L_i)" }, { label: "Current Gini", expression: "Pre = " + out.preGini + "; post = " + out.postGini }],
    stakeholders: [{ stakeholder: "Lowest-income quintile", direction: out.afterTax[0] >= out.preTax[0] ? "Gains" : "Loses", magnitude: "Income " + out.preTax[0] + " → " + out.afterTax[0], shortRun: "Receives transfer and any minimum-income top-up.", reason: "Post-tax disposable income is calculated directly." }, { stakeholder: "Highest-income quintile", direction: out.afterTax[4] >= out.preTax[4] ? "Gains" : "Loses", magnitude: "Income " + out.preTax[4] + " → " + out.afterTax[4], shortRun: "Pays a larger tax amount under progressive taxation.", reason: "Tax is linked to relative income." }, { stakeholder: "Taxpayers / public budget", direction: out.netFiscalImpact >= 0 ? "Gains" : "Loses", shortRun: "Net fiscal impact is " + out.netFiscalImpact + ".", equity: "Gini falls by " + Math.abs(out.giniChange) + " when negative.", reason: "Revenue is compared with transfers in the same index units." }],
    results: { preGini: out.preGini, postGini: out.postGini, giniChange: out.giniChange, revenue: out.revenue, transferCost: out.transferCost, netFiscalImpact: out.netFiscalImpact },
    chart: { title: "Lorenz curve comparison", subtitle: "The 45-degree line represents equality. Values use five equal population quintiles.", data: lorenzData, x: "population", lines: [{ key: "equality", label: "Line of equality", color: "var(--ink-faint)", dashed: true }, { key: "prePolicy", label: "Pre-policy Lorenz", color: "var(--red)" }, { key: "postPolicy", label: "Post-policy Lorenz", color: "var(--accent)" }] },
  };
}

function chain(parameter: string, response: string, immediate: string, behaviour: string, outcome: string, consequence: string): MechanismStep[] {
  return [{ stage: "Parameter change", text: parameter }, { stage: "Model response", text: response }, { stage: "Immediate effect", text: immediate }, { stage: "Behavioural response", text: behaviour }, { stage: "New outcome", text: outcome }, { stage: "Trade-off", text: consequence }];
}

function LabVisual({ model, definition }: { model: NewLabKey; definition: Definition }) {
  if (model === "prisoners-dilemma" && definition.chart.matrix) {
    return <ChartContainer title={definition.chart.title} subtitle={definition.chart.subtitle} modelLabel={labels[model].title}><div className="overflow-x-auto"><table className="min-w-[580px] w-full border-separate border-spacing-2 text-center"><thead><tr><th rowSpan={2} className="p-2 text-xs text-[var(--ink-faint)]">Player A / B</th><th colSpan={2} className="p-2 text-sm">Player B</th></tr><tr><th className="p-2 text-xs">Cooperate</th><th className="p-2 text-xs">Defect</th></tr></thead><tbody>{["C", "D"].map((action) => <tr key={action}><th className="p-2 text-xs">{action === "C" ? "Cooperate" : "Defect"}</th>{["C", "D"].map((other) => { const cell = definition.chart.matrix!.find((item) => item.aAction === action && item.bAction === other)!; return <td key={other} className={"rounded-lg border p-4 text-sm " + (cell.nash ? "border-[var(--amber)] bg-[var(--amber-soft)]" : cell.pareto ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-[var(--line)] bg-[var(--canvas)]")}><p className="font-mono text-xl font-bold">({cell.a}, {cell.b})</p><p className="mt-2 text-[10px] text-[var(--ink-muted)]">{cell.aBestResponse ? "A best response · " : ""}{cell.bBestResponse ? "B best response" : ""}</p>{cell.nash && <p className="mt-2 text-xs font-bold text-[var(--amber)]">Nash equilibrium</p>}{cell.pareto && <p className="mt-1 text-xs font-bold text-[var(--accent)]">Pareto efficient</p>}</td>; })}</tr>)}</tbody></table></div></ChartContainer>;
  }
  const chart = definition.chart;
  return <ChartContainer title={chart.title} subtitle={chart.subtitle} modelLabel={labels[model].title}><div className="h-[420px]"><ResponsiveContainer width="100%" height="100%"><LineChart data={chart.data} margin={{ top: 18, right: 26, left: -6, bottom: 8 }}><CartesianGrid stroke="var(--line)" strokeDasharray="3 5" vertical={false} /><XAxis dataKey={chart.x} type="number" tick={{ fill: "var(--ink-muted)", fontSize: 10 }} axisLine={{ stroke: "var(--line-strong)" }} tickLine={false} /><YAxis tick={{ fill: "var(--ink-muted)", fontSize: 10 }} axisLine={false} tickLine={false} /><Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 10, fontSize: 11 }} /><Legend wrapperStyle={{ fontSize: 11, paddingTop: 12 }} />{chart.lines?.map((line) => <Line key={line.key} type="monotone" dataKey={line.key} name={line.label} stroke={line.color} strokeWidth={2.5} strokeDasharray={line.dashed ? "6 4" : undefined} dot={false} />)}{chart.dot && <ReferenceDot x={chart.dot.x} y={chart.dot.y} r={6} fill="var(--surface)" stroke="var(--ink)" strokeWidth={3} />}</LineChart></ResponsiveContainer></div></ChartContainer>;
}

const strategyOptions: Strategy[] = ["always-cooperate", "always-defect", "tit-for-tat", "grim-trigger", "win-stay-lose-shift"];
function StrategyControls({ values, update }: { values: Values; update: (key: string, value: Value) => void }) {
  return <div className="border-t border-[var(--line)] pt-4"><p className="text-xs font-bold">Selected strategies</p><div className="mt-3 grid gap-3"><label className="text-xs font-semibold">Player A<select value={String(values.strategyA)} onChange={(event) => update("strategyA", event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-[var(--line-strong)] bg-[var(--surface)] px-3 text-sm font-normal"><>{strategyOptions.map((strategy) => <option key={strategy} value={strategy}>{strategy}</option>)}</></select></label><label className="text-xs font-semibold">Player B<select value={String(values.strategyB)} onChange={(event) => update("strategyB", event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-[var(--line-strong)] bg-[var(--surface)] px-3 text-sm font-normal"><>{strategyOptions.map((strategy) => <option key={strategy} value={strategy}>{strategy}</option>)}</></select></label></div></div>;
}

function TaxSystemControl({ value, update }: { value: string; update: (key: string, value: Value) => void }) {
  return <div className="border-t border-[var(--line)] pt-4"><label className="text-xs font-bold">Tax system<select value={value} onChange={(event) => update("taxSystem", event.target.value)} className="mt-2 h-10 w-full rounded-lg border border-[var(--line-strong)] bg-[var(--surface)] px-3 text-sm font-normal"><option value="progressive">Progressive tax</option><option value="flat">Flat tax</option></select></label><p className="mt-2 text-[11px] leading-5 text-[var(--ink-muted)]">Progressive tax applies a higher effective rate to higher relative incomes. This is a stylised arithmetic rule.</p></div>;
}
