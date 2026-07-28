# Real-World Cases

EconMind OS adds six versioned, classroom-safe cases without replacing the existing model library:

- Oil Price Shock
- Carbon Tax Design
- Housing Rent Control
- Minimum Wage
- Tariff Conflict
- Restaurant Food Waste

Every case uses the same ten stages: context, problem definition, model mapping, initial conditions, prediction, simulation, comparison, evaluation, recommendation, and reflection. The numeric simulation remains in browser-side TypeScript. Dragging controls does not write to Supabase.

## Data and modelling boundary

The case definitions distinguish official context sources from calibrated, indexed, or stylised inputs. A displayed number is never presented as a forecast unless it is explicitly sourced and dated. The restaurant case is anonymised and does not contain private restaurant data.

The food-waste case uses a deterministic newsvendor-style engine:

- demand is normally approximated;
- expected sales are bounded by demand and prepared inventory;
- waste, shortage, revenue, production, disposal, complaint, and simplified insurance costs are shown separately;
- an insurance result is an eligible-loss teaching formula, not an insurance quotation.

## Saving and privacy

Guests keep their active case draft and scenario snapshots in `localStorage`. A signed-in user can choose a title and explicitly save a run. That action writes a single `case_runs` record. RLS restricts every run to its `user_id`; teachers do not receive automatic access to learner runs.

Run the migration `20260728010000_real_world_cases_daily_brief.sql` after the existing EconMind migrations. It creates `economic_cases` for editorial metadata and `case_runs` for private learner records. The full teaching definitions remain versioned in `lib/cases/definitions.ts` in this first release, so static GitHub Pages builds can still open all six cases without a database request.

## Teaching use

The evaluation score is deliberately not a recommendation engine. Learners set the relative weights for efficiency, equity, and fiscal sustainability, and the score explains those weights. The final recommendation requires a benefit, cost, affected stakeholder, trade-off, assumption, limitation, and next evidence needed.
