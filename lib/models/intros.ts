import type { ModelSlug } from "@/lib/models/registry";

export type ModelIntroduction = {
  question: string;
  method: string;
  reading: string;
};

export const MODEL_INTRODUCTIONS: Partial<Record<ModelSlug, ModelIntroduction>> = {
  "supply-demand": {
    question: "How do buyers and sellers jointly determine the price, quantity, and gains from trade in a competitive market?",
    method: "Move demand or supply intercepts to shift a curve, then change slopes to alter price responsiveness. The chart solves the intersection of Qd = a − bP and Qs = c + dP immediately.",
    reading: "Read the equilibrium point first, then compare consumer surplus, producer surplus, and total surplus. A curve shift changes the market environment; a slope change changes how strongly agents react to price.",
  },
  policy: {
    question: "Who actually bears a per-unit tax, or receives the benefit of a per-unit subsidy, once prices and quantity adjust?",
    method: "Set a positive wedge for a tax or a negative wedge for a subsidy. Vary the two slopes to change relative price responsiveness, then inspect buyer price, seller price, government balance, and deadweight loss.",
    reading: "Legal collection is not economic incidence. The less price-responsive side bears more of a tax burden or receives more of a subsidy benefit.",
  },
  "price-controls": {
    question: "When does a legal ceiling or floor become binding, and what happens to the quantity actually traded?",
    method: "Choose a ceiling or floor and move it relative to the unregulated equilibrium. The model calculates desired demand, desired supply, and short-side trade.",
    reading: "A lower price does not guarantee access: a binding ceiling can create shortages and rationing. A binding floor can create unsold output. Queueing and black markets are discussed as limitations, not calculated forecasts.",
  },
  elasticity: {
    question: "Why can the same linear demand curve be elastic at one price and inelastic at another?",
    method: "Move the price along the demand curve and alter its slope or intercept. The lab calculates point elasticity, quantity demanded, and total revenue at the selected point.",
    reading: "Use the elasticity label to interpret revenue: with elastic demand, a price cut raises revenue; with inelastic demand, a price rise raises revenue. This is a local result, not a causal estimate.",
  },
  externalities: {
    question: "Why can a market produce too much of a harmful good or too little of a beneficial good?",
    method: "Set the per-unit external cost or benefit, then compare the private equilibrium with the point where marginal benefit equals marginal social cost.",
    reading: "The corrective tax or subsidy equals the stated spillover in this model. It demonstrates an efficiency condition, not the empirical value of any real-world carbon price or social benefit.",
  },
  monopoly: {
    question: "How does a single-price monopolist choose output, price, profit, and markup compared with a competitive benchmark?",
    method: "Change demand, marginal cost, or fixed cost. The model finds output where marginal revenue equals marginal cost and reads price from demand.",
    reading: "Fixed cost changes profit but not the simplified MR = MC output decision. Compare monopoly output and price with the competitive result to interpret the calculated deadweight loss.",
  },
  ppf: {
    question: "How does scarcity create opportunity cost, and how can a production bundle be efficient, inefficient, or unattainable?",
    method: "Change productive capacity, allocation, capacity use, curvature, and growth. The plot locates the selected bundle relative to the frontier.",
    reading: "A point on the frontier is efficient under the model's assumptions; a point inside may reflect unused capacity, while a point outside cannot be produced with current resources.",
  },
  "ad-as": {
    question: "How do aggregate-demand and short-run supply disturbances change output, the price level, and the output gap?",
    method: "Change demand and supply shocks, potential output, and curve sensitivities. The model solves the intersection of stylised AD and SRAS schedules.",
    reading: "A demand expansion and an adverse supply shock can both raise prices, but they have different output and employment implications. All indices are educational, not macroeconomic forecasts.",
  },
  "is-lm": {
    question: "How are output and the interest rate determined when the goods market and money market must clear together?",
    method: "Adjust consumption, taxes, government spending, investment sensitivity, money supply, prices, and money-demand sensitivities. The chart solves the IS–LM intersection.",
    reading: "Use the counterfactual investment result to discuss crowding out. Fiscal and monetary policy work through different curves and can produce different output–interest-rate combinations.",
  },
  "prisoners-dilemma": {
    question: "When do individually rational actions produce a collectively worse outcome?",
    method: "Edit every payoff in the 2×2 matrix. The lab marks each player's best responses, pure Nash equilibria, Pareto-efficient cells, and joint-payoff maxima.",
    reading: "A Nash equilibrium is stable against unilateral deviation, not necessarily fair or efficient. The standard Prisoner's Dilemma requires defection to be strictly dominant for both players and mutual cooperation to create more joint welfare.",
  },
  "repeated-games": {
    question: "How can future interaction, contingent strategies, and mistakes affect incentives to cooperate?",
    method: "Choose a strategy for each player and vary rounds, discounting, future-interaction probability, and noise. The timeline tracks actions and cumulative payoffs.",
    reading: "No displayed strategy is universally optimal. The outcome is conditional on the payoff structure, horizon, future weight, and the deterministic mistake sequence.",
  },
  cournot: {
    question: "How do two quantity-setting firms respond to one another, and how does their market outcome compare with monopoly and competition?",
    method: "Set demand and costs, then move each firm's output. The chart shows both best-response curves and the Cournot–Nash intersection.",
    reading: "A current quantity pair is an equilibrium only when each firm is choosing its best response to the other's output. Consumer surplus and welfare comparisons use the stated linear-demand benchmark.",
  },
  "phillips-curve": {
    question: "How can inflation, expected inflation, unemployment, and supply shocks be related in the short run?",
    method: "Change expected inflation, unemployment, the natural rate, curve sensitivity, supply shock, and demand pressure. The lab distinguishes a movement along the SRPC from a curve shift.",
    reading: "The long-run reference is the natural unemployment rate in this stylised model. It does not assert a permanent inflation–unemployment trade-off or forecast either variable.",
  },
  "solow-growth": {
    question: "How do savings, depreciation, population growth, technology, and capital accumulation shape a stylised steady state?",
    method: "Adjust the seven growth parameters and inspect saving, break-even investment, the steady-state intersection, and the time path.",
    reading: "A higher saving rate can raise the long-run level of output per effective worker. In the standard Solow interpretation, variables per effective worker converge, while technology growth drives sustained growth of output per worker.",
  },
  "lorenz-gini": {
    question: "How can a five-quintile income distribution be represented with a Lorenz curve and summarized by a Gini coefficient?",
    method: "Edit each quintile's income and choose a progressive or flat tax, transfer, and income floor. The chart compares pre-policy and post-policy Lorenz curves.",
    reading: "The Gini is a discrete trapezoid approximation to the Lorenz curve. A lower Gini signals less measured inequality here, not a complete welfare or policy evaluation.",
  },
  "policy-lab": {
    question: "How should a policy package be judged when the objective itself involves unavoidable trade-offs?",
    method: "Choose one fixed scenario, select a priority, write a prediction, and change only the permitted controls. The shared Sandbox engine then supplies transparent outcomes and contributions.",
    reading: "The score is a classroom aid conditional on your chosen priority. It is not a real-world recommendation, and the stakeholder and evaluation panels make the trade-offs explicit.",
  },
  sandbox: {
    question: "How can several policy instruments interact when output, inflation, employment, distribution, firms, trade, and emissions all matter?",
    method: "Combine policies freely or start from a preset. The simulator separates direct contribution rules, supported interaction rules, and final bounded indicators.",
    reading: "Treat results as a transparent teaching system. Every coefficient is stylised; the contribution table explains arithmetic rather than claiming empirical causal estimates.",
  },
};
