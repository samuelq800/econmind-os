# Model integrity and linked-workspace notes

## Local change tracking and comparisons

Every supported interactive model records its most recent meaningful control change in the browser. A numeric difference smaller than `max(1e-7, 1e-6 × |previous value|)` is ignored. The record includes the old and new values, direction, affected equation, curve, displayed outputs, update order, and timestamp.

`OutcomeComparison` keeps three distinct references: the immediately previous state, the model's declared default result vector, and Scenario A when the learner saves one. Arrow colours indicate numerical increase or decrease only; they are not welfare labels.

## Cross-model mapping

The central source is `lib/models/model-mapping.ts`. It documents every coefficient, source metric, target metric, transformation, rationale, limitation, and whether a link is structural, calibrated, or stylised.

| Link | Rule | Status |
| --- | --- | --- |
| Sandbox spending index → IS–LM G | `(spending index − 100) × 0.6` | Stylised |
| Sandbox money-growth rate → IS–LM M | `(growth − 3) × 3` | Stylised |
| IS–LM output → AD–AS ΔAD | `% change in Y × 0.6` | Educational calibration |
| AD–AS output gap → Phillips unemployment | `u − un = −0.5 × output gap` | Stylised Okun-style rule |
| AD–AS supply shock → Phillips supply shock | `−0.08 × AD–AS shock` | Stylised |

The original native output is never hidden. The workspace uses a baseline-100 normalised view only to compare directional movements across incompatible scales. It does not sum them or imply that a Sandbox GDP index, IS–LM output level, AD–AS index, and Phillips inflation rate are the same quantity.

## Integrated Workspace presets

- Monetary & Fiscal Policy: one macro state maps to IS–LM, then AD–AS, then the Phillips Curve.
- Market Structure: one demand and marginal-cost configuration feeds monopoly, Cournot, and a competitive benchmark.
- Distribution & Policy: tax/subsidy and price-control results stay separate; positive tax revenue is mapped to an equal transfer at `revenue / 250` only as a clearly labelled classroom exercise before the Lorenz calculation.

## Stakeholder rules

Stakeholder panels use `improves`, `worsens`, `mixed`, `unchanged`, or `indeterminate`. Each conclusion names a comparison baseline, metrics, mechanism, and uncertainty where required. A lower price is not universally called an improvement under rationing; users who obtain a controlled good and those unable to obtain it are displayed separately.

## Audit coverage and limitations

The unit suites include known answers, boundaries, invariants, numerical stability, and invalid-input handling for the major engines. Invalid systems return a finite zero-result state with a validation message instead of passing `NaN` or infinity to a chart.

The development-only `/dev/model-health` route shows coverage categories locally and resolves as unavailable in production. The models remain deterministic educational constructions rather than forecasts, causal estimates, fiscal micro-simulations, or empirical policy advice.
