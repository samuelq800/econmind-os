import type { FocusedModelKey } from "@/lib/experiments/model-runtime";

export type AssumptionSections = {
  structural: readonly string[];
  parameters: readonly string[];
  limitations: readonly string[];
};

export const MODEL_ASSUMPTIONS: Record<FocusedModelKey, AssumptionSections> = {
  "supply-demand": {
    structural: ["Many price-taking buyers and sellers trade a homogeneous good.", "Demand and supply are linear over the displayed range."],
    parameters: ["Intercept changes shift a curve; slope changes rotate it.", "All other determinants are held constant when one parameter changes."],
    limitations: ["The model cannot establish real-world demand or supply without data.", "It excludes taxes, controls, externalities, transaction costs, and information failures."],
  },
  policy: {
    structural: ["Demand and supply are linear, and the policy is a constant per-unit wedge.", "The wedge is fully enforced without evasion or delayed adjustment."],
    parameters: ["Positive wedge values are taxes; negative values are subsidies.", "Incidence follows relative price responsiveness, not legal remittance."],
    limitations: ["The model cannot value how government funds are spent or raised.", "It excludes administrative cost, distributional objectives, and wider general-equilibrium effects."],
  },
  "price-controls": {
    structural: ["The legal ceiling or floor is perfectly enforced for every unit.", "Quantity traded is limited by the short side of the market."],
    parameters: ["A ceiling binds only below equilibrium; a floor binds only above it.", "Surplus calculations assume scarce units reach the highest-value buyers."],
    limitations: ["The model cannot predict queues, black markets, quality changes, or search costs.", "It excludes government purchases and enforcement failures."],
  },
  elasticity: {
    structural: ["Demand follows the linear equation Q = a − bP.", "The exercise describes movement along one demand curve."],
    parameters: ["Point elasticity is local to the selected price and quantity.", "Total revenue equals price times quantity; cost is not a parameter."],
    limitations: ["The model cannot infer causal price responses from observed data.", "It does not calculate profit, cross-price effects, income effects, or long-run adjustment."],
  },
  externalities: {
    structural: ["The external cost or benefit is constant for each additional unit.", "Private decision-makers ignore the spillover."],
    parameters: ["Positive externalCost represents harm; negative values represent a benefit.", "The corrective policy is assumed equal to the marginal spillover."],
    limitations: ["The model cannot estimate an empirical social cost without evidence.", "It excludes administrative cost, distribution, uncertainty, and use of policy revenue."],
  },
  monopoly: {
    structural: ["One single-price firm serves the market with no entry or strategic rivals.", "Demand is linear and marginal cost is constant."],
    parameters: ["The firm chooses output where MR = MC and reads price from demand.", "Fixed cost changes profit but not the simplified output choice."],
    limitations: ["The model cannot explain entry, innovation, regulation, or price discrimination.", "It does not represent multi-product costs or dynamic competition."],
  },
  ppf: {
    structural: ["The economy produces two composite goods with a fixed resource stock.", "The curved frontier represents increasing opportunity cost."],
    parameters: ["Capacity use scales the selected bundle relative to the frontier.", "The growth control shifts both axis limits proportionally."],
    limitations: ["The model cannot identify actual production possibilities without data.", "It excludes trade, distribution, sector-specific growth, and adjustment costs."],
  },
  "ad-as": {
    structural: ["AD and SRAS are stylized linear relationships expressed as indices.", "Potential output is fixed during each short-run comparison."],
    parameters: ["Demand and supply shocks are exogenous horizontal displacements.", "Sensitivity values control movement along the two curves."],
    limitations: ["The model cannot forecast GDP, inflation, or unemployment.", "It excludes expectations, wage dynamics, policy lags, and long-run adjustment paths."],
  },
};
