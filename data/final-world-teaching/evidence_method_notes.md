# Evidence Lab method notes

Version 0.1.0 · 2026-07-30 · `derived` unless stated otherwise.

The three files in `evidence_samples/` are deliberately small, fixed **`synthetic_calibration`** teaching samples. They demonstrate computation and grading without representing real respondents, businesses, or historical observations. The reproducible public source routes, access notes, variable definitions, and cautions are in `evidence_lab_projects.json` and [sources.md](sources.md).

## Flexible Work and Wellbeing

Use OLS, then worker and month fixed effects:

\[
W_{it}=\alpha+\beta R_{it}+\gamma L_{it}+u_{it},\qquad
W_{it}=\alpha_i+\tau_t+\beta R_{it}+\gamma L_{it}+u_{it}.
\]

`W` is wellbeing on a 0–10 scale; `R` is remote days/week; `L` is workload index. OLS is an association. Fixed effects remove time-invariant worker differences, not changing workload, manager quality, selection into flexibility, or reverse causality. ATUS wellbeing microdata is a public route for a documented source extract; ONS provides an open supplementary homeworking source. Do not pool their definitions without harmonisation.

## Restaurant Demand and Food Waste

For a single perishable product with demand `D`, order `Q`, price `p`, cost `c`, and salvage `s`, the newsvendor critical fractile is:

\[
F(Q^*)=\frac{C_u}{C_u+C_o}=\frac{p-c}{p-s}.
\]

The illustrative sample has `p=12`, `c=5`, `s=1`, so the target fractile is `7/11≈0.6364`. Validate `sold=min(D,Q)` and `waste=max(Q-D,0)`. Aggregate USDA/FAO material gives context only; it cannot identify restaurant-level demand or waste causally.

## Oil Prices and Inflation

Transform an oil level into a monthly mean and use `100*ln(P_t/P_(t-1))`. A compact distributed-lag association is:

\[
\pi_t=\alpha+\beta_0\Delta oil_t+\beta_1\Delta oil_{t-1}+\gamma gap_t+e_t.
\]

Oil changes are not randomly assigned. Global demand, supply disruptions, exchange rates, price controls, monetary policy, serial correlation, revisions, and a short sample all prevent a causal conclusion. For observed work, download dated FRED vintages, retain the original units and metadata, aggregate the daily series to monthly means, and archive the raw extract separately.

## Reproduction and validation

- Keep observed raw downloads separate from the teaching samples and retain source URL, retrieval date, licence/access note, coverage, units, and transformation.
- Show intervals and diagnostics (residuals, influential points, balance/pre-trends where relevant); never grade a causal conclusion from correlation alone.
- A chart is explanatory only when it carries units, time coverage, status, and a source note.
