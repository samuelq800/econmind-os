export const MODEL_ASSUMPTIONS = {
  "supply-demand": [
    "Demand and supply are linear over the displayed range.",
    "Many price-taking buyers and sellers trade a homogeneous good.",
    "Other determinants of demand and supply are held constant when one parameter changes.",
    "There are no taxes, price controls, externalities, transaction costs, or information failures.",
  ],
  policy: [
    "Demand and supply are linear, and the policy is a constant amount per unit traded.",
    "The wedge is fully enforced with no evasion, administrative cost, or delayed adjustment.",
    "Economic incidence depends on relative price responsiveness, not on who legally remits the tax or receives the subsidy.",
    "Government revenue or spending is reported separately; no additional social value of public funds is modeled.",
  ],
  "price-controls": [
    "The legal ceiling or floor is perfectly enforced and applies to every unit in the market.",
    "Quantity traded is limited by the short side of the market.",
    "Consumer surplus under a binding control assumes scarce units are allocated to the highest-value buyers.",
    "Search costs, queues, quality changes, black markets, and government purchases are excluded.",
  ],
  elasticity: [
    "Demand follows the linear equation Q = a − bP over the displayed range.",
    "Point elasticity measures a local response at the selected price, holding other demand factors constant.",
    "Total revenue equals price times quantity; production cost and profit are not modeled.",
    "The exercise describes movement along one demand curve, not a shift of demand.",
  ],
  externalities: [
    "The external cost or benefit is constant for every additional unit.",
    "Buyers and sellers ignore the spillover when making private decisions.",
    "A corrective per-unit tax or subsidy can be targeted exactly and enforced without administrative cost.",
    "Distributional effects and how policy revenue is used are outside the welfare comparison.",
  ],
  monopoly: [
    "One firm serves the market, charges a single price, and faces no current or potential entry.",
    "Market demand is linear and marginal cost is constant.",
    "The firm maximizes profit by choosing output where marginal revenue equals marginal cost.",
    "Fixed cost changes profit but not the simplified output choice; price discrimination and strategic rivalry are excluded.",
  ],
  ppf: [
    "The economy produces only two composite goods with a fixed resource stock at a point in time.",
    "The curved frontier represents increasing opportunity cost as resources move toward Good X.",
    "Capacity use scales the selected bundle; points outside the frontier are not currently attainable.",
    "The capacity-shift control changes both axis limits proportionally, abstracting from sector-specific growth.",
  ],
  "ad-as": [
    "AD and SRAS are stylized linear relationships expressed as teaching indices.",
    "Potential output is a fixed benchmark during each comparison, and shocks are treated as exogenous.",
    "The equilibrium is short-run; wage adjustment, expectations, and long-run return dynamics are not simulated.",
    "The unemployment-gap relationship is an illustrative Okun-style rule, not an empirical estimate or forecast.",
  ],
} as const;
