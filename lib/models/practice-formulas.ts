const formulae: Record<string, string> = {
  labour_market: "L_d=a-bw,\\qquad L_s=c+dw",
  monopsony: "w(L)=a+bL,\\qquad ME=a+2bL,\\qquad MRP=ME",
  public_goods: "\\pi_i=e_i-c_i+\\frac{m}{n}\\sum_j c_j",
  common_pool_resources:
    "S_{t+1}=S_t+rS_t\\left(1-\\frac{S_t}{K}\\right)-\\sum_i h_i",
  information_asymmetry:
    "E[v\\mid\\mathrm{signal}]=\\sum_{type}p(type\\mid\\mathrm{signal})v_{type}",
  adverse_selection: "P_{pool}=E[p_iL]+\\mathrm{loading}",
  moral_hazard:
    "\\max_e\\;u(w-\\mathrm{premium}-\\mathrm{effort\\ cost}+\\mathrm{coverage}\\cdot\\mathrm{loss})",
  signalling: "c_H(s)-c_H(0)<w_H-w_L<c_L(s)-c_L(0)",
  keynesian_multiplier: "\\Delta Y=k\\Delta G,\\qquad k=\\frac{1}{1-c(1-t)+m}",
  monetary_policy:
    "i_t=r^*+\\pi_t+\\phi_\\pi(\\pi_t-\\pi^*)+\\phi_y\\,y^{gap}_t",
  fiscal_policy: "\\Delta Y=k_G\\Delta G+k_T\\Delta T",
  public_debt: "d_t=\\left(\\frac{1+r_t}{1+g_t}\\right)d_{t-1}-pb_t",
  business_cycle:
    "y_{gap}=\\frac{Y-Y_p}{Y_p},\\qquad\\Delta u=-\\beta\\Delta y_{gap}",
  money_market: "\\frac{M}{P}=L(Y,i)=kY-hi,\\qquad i=\\frac{kY-M/P}{h}",
  loanable_funds: "S(r)=I(r)+DEF",
  bank_credit_creation: "\\Delta D=\\left(\\frac{1}{rr}\\right)\\Delta R",
  comparative_advantage: "OC_X=\\frac{a_{LX}}{a_{LY}}",
  tariffs: "P_d=P_w(1+t),\\qquad R=tP_wM",
  quotas: "\\mathrm{rent}=(P_q-P_w)\\cdot\\mathrm{quota}",
  exchange_rates: "\\Delta e=100\\ln\\left(\\frac{e_t}{e_{t-1}}\\right)",
  balance_of_payments: "CA+KA+FA+EO=\\Delta R",
  marshall_lerner: "|\\varepsilon_x|+|\\varepsilon_m|>1",
  j_curve:
    "TB(t)=\\mathrm{price\\ effect}(t)+\\mathrm{volume\\ effect}(t-\\mathrm{lag})",
  ppp: "\\Delta s\\approx\\pi-\\pi^*",
  newsvendor: "F(Q^*)=\\frac{C_u}{C_u+C_o}=\\frac{p-c}{p-s}",
  inventory_optimisation: "Q^*=\\sqrt{\\frac{2DS}{H}}",
  demand_forecasting: "F_{t+1}=\\alpha D_t+(1-\\alpha)F_t",
  insurance_risk_pooling: "E[\\mathrm{claims}]=\\sum_i p_iL_i",
  expected_value: "E[X]=\\sum_i p_i x_i",
  ols: "\\hat{\\beta}=(X^{\\prime}X)^{-1}X^{\\prime}y",
  multiple_regression: "y=\\beta_0+\\beta_1x_1+\\beta_2x_2+u",
  fixed_effects: "y_{it}=\\alpha_i+\\tau_t+\\beta x_{it}+u_{it}",
  difference_in_differences:
    "\\delta=(\\bar y_{T,post}-\\bar y_{T,pre})-(\\bar y_{C,post}-\\bar y_{C,pre})",
  logit: "Pr(Y=1\\mid X)=\\frac{1}{1+e^{-X\\beta}}",
  rdd: "\\tau=\\lim_{x\\downarrow c}E[Y\\mid x]-\\lim_{x\\uparrow c}E[Y\\mid x]",
  iv: "\\beta_{IV}=\\frac{\\mathrm{Cov}(Z,Y)}{\\mathrm{Cov}(Z,X)}",
  confidence_intervals:
    "(\\widehat{\\theta}\\pm\\mathrm{critical\\ value}\\cdot SE)",
};

const symbols: Record<string, string> = {
  M_over_P: "\\frac{M}{P}",
  dY: "\\Delta Y",
  dD: "\\Delta D",
  max_dD: "\\max\\,\\Delta D",
  dR: "\\Delta R",
  d_next: "d_{t}",
  output_gap_pct: "y_{gap}",
  oc_x_A: "OC_X^A",
  TB_3: "TB_3",
  F_next: "F_{t+1}",
  payoff_each: "\\pi_i",
  expected_value: "E[v]",
  fair_premium: "P_{pool}",
  prevention_net_value: "\\Delta EU",
  within_slope: "\\hat{\\beta}_{within}",
  beta_IV: "\\hat{\\beta}_{IV}",
  DiD: "\\hat{\\delta}",
  critical_ratio: "\\frac{C_u}{C_u+C_o}",
  predicted_depreciation_pct: "\\Delta s",
  depreciation_pct: "\\Delta e",
  lower: "CI_{lower}",
  p: "p",
};

export function practiceFormula(modelId: string) {
  return (
    formulae[modelId] ??
    "\\text{Use the versioned model equation shown in the formula catalogue.}"
  );
}

export function practiceSymbol(key: string) {
  return symbols[key] ?? key.replaceAll("_", "\\_");
}

function valueLatex(value: unknown): string {
  if (Array.isArray(value))
    return `\\left[${value.map(valueLatex).join(",\\;")}\\right]`;
  if (typeof value === "number")
    return Number.isInteger(value) ? String(value) : String(value);
  if (typeof value === "boolean")
    return value ? "\\mathrm{true}" : "\\mathrm{false}";
  return `\\mathrm{${String(value).replaceAll("_", "\\ ")}}`;
}

export function practiceInputLatex(input: Record<string, unknown>) {
  return Object.entries(input)
    .map(([key, value]) => `${practiceSymbol(key)}=${valueLatex(value)}`)
    .join("\\qquad");
}
