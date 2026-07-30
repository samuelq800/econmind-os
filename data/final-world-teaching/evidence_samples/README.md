# Evidence Lab teaching samples

Version `0.1.0` · 2026-07-30 · status: `synthetic_calibration`.

These three compact CSV files are intentionally fictional calculation samples, not downloaded observations. Every row carries a `status` column. Their public reproduction routes, source links, coverage, units, cleaning procedures, licences/access notes, formulae, and causal limits are defined in `../evidence_lab_projects.json` and `../sources.md`.

Validation:

- CSV headers must match the variable dictionary of the owning project.
- Numeric quantities must be finite and use the declared units.
- `restaurant_food_waste_sample.csv` must satisfy `sold_qty=min(actual_meals,order_qty)` and `waste_qty=max(order_qty-actual_meals,0)`.
- No UI, chart, or exported result may relabel these rows as `observed`.
