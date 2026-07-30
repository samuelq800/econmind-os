# EconMind OS economic data request catalogue

Use this document as the collection brief for the calibration/data conversation. It defines the data needed to move from a structurally complete platform to economically calibrated models. Do not fabricate values: each record needs a source, date, unit, method and confidence note.

## Universal submission requirements

| Field | Requirement |
| --- | --- |
| `dataset_id` | Stable snake-case identifier. |
| `source` | Primary source, study, official dataset or transparent derivation. |
| `coverage` | Geography/model/scenario, start/end date and frequency. |
| `unit` | Explicit level, rate, index, currency, quantity or probability. |
| `definition` | Exact measurement definition and transformations. |
| `value` | Numeric values, ranges or equations; never a prose-only claim. |
| `assumptions` | Conditions under which the value/equation applies. |
| `uncertainty` | Confidence interval, range, sensitivity or qualitative caveat. |
| `version` | Version and retrieval date. |
| `licence` | Reuse restrictions and attribution requirements. |

## A. Cross-model formula and variable catalogue

| Dataset / table | Required fields | Why it is needed |
| --- | --- | --- |
| Canonical variable dictionary | ID, symbol, name, definition, unit, kind, valid range, default, precision, conversion rules | Ensures every graph, equation, Composer connection and World indicator uses the same meanings and units. |
| Model equation catalogue | model ID, equation ID, display equation, formal derivation, symbols, domain, assumptions, source | Required before publishing equations or model calculations as calibrated. |
| Model parameter catalogue | model ID, parameter ID, default, min/max, step, units, calibration method, sensitivity, source | Drives sliders, presets, Practice states and reproducible model runs. |
| Output and welfare catalogue | output ID, formula, unit, baseline definition, affected agents, time horizon | Standardises results, surplus, distribution and dashboards. |
| Graph binding catalogue | graph ID, axis variables/units, curve equations, equilibrium method, tooltip format, accessible summary | Makes graphs consistent, calculable and accessible. |
| Test-vector catalogue | input state, expected output, tolerance, source/derivation | Enables deterministic unit tests for every formula. |

## B. Learning-system content data

| Dataset / table | Required fields | Initial scope |
| --- | --- | --- |
| Model metadata | objectives, agents, assumptions, limitations, common errors, prerequisites, linked models/cases/evidence | Every published model. |
| Practice question bank | six questions per model; initial state; adjustable/locked variables; accepted conditions; tolerance; explanation; hint; common error | Exactly six structured questions for each published model. |
| Composer mappings | output variable, input variable, unit conversion, transformation, time lag, compatibility/conflict rule | Oil shock, fiscal expansion, tariff conflict, inventory, flexible-work templates first. |
| Compare matrices | compared models/policies, assumptions, predicted direction, horizon, welfare/distribution, reversal conditions | Eight required preset comparisons. |
| Curated evidence records | model prediction, observable variables, study/sample, method, result, support status, limitations | Flexible work, food waste/inventory, oil/inflation first. No user uploads. |
| Real-world case data | factual context, actors, time series/indicators, policy choices, source citations, model mappings | Twelve specified cases. |

## C. EconBench and Mechanism Arena inputs

| Dataset / table | Required fields | Initial scope |
| --- | --- | --- |
| EconBench scenario definitions | context, initial indicators, shock, roles, objectives, constraints, policy options, accepted answer, error tags | Ten specified authored scenarios. |
| Auction parameters | valuation distributions, bidder count, reserve price, tie rule, utility/payoff definitions | First-price and Vickrey auctions. |
| Matching parameters | participants, capacities, preferences, priorities, algorithm rules | School matching. |
| Strategic-game payoff parameters | endowments, payoff functions, information structure, action sets, AI strategy rules | Public goods, bank run, principal-agent and repeated dilemma. |
| Resource/environment parameters | regeneration, abatement cost curves, emissions intensity, permit rules, enforcement/fine schedules | Common-pool resource and carbon market. |
| Insurance parameters | risk-type distribution, loss distribution, premium/coverage/subsidy, participation rules | Adverse selection and risk pooling. |

## D. Continuous World Economy: country starting state

Collect one consistent initial snapshot for each of Asterra, Bellune, Cyrenia, Damaris, Eryndor, Falcrest, Gavren, Helion, Iskara, Jorvia, Kordell and Lumeria. Values may be synthetic/calibrated, but they must be internally coherent and clearly labelled as fictional calibration.

| Domain | Required variables | Units / checks |
| --- | --- | --- |
| Demography and output | population, GDP, GDP per capita, potential output, trend growth, productivity, participation | people; constant base currency; annual %; index. GDP = GDP per capita × population after unit adjustment. |
| Prices and labour | CPI/inflation, unemployment, wage index, employment, output gap | annual % or index; state Phillips/Okun assumptions. |
| Fiscal | tax revenue by type, spending by function, primary balance, overall balance, debt, debt service, fiscal capacity | % GDP and base currency; deficit/debt identities must reconcile. |
| Monetary and banking | policy rate, money supply, credit, liquidity, bank capital/stability, inflation expectation, central-bank credibility | %, indices and base currency; define stock vs flow. |
| External sector | exports/imports by commodity, services, current account, financial account, reserves, external debt, FDI/portfolio flows | base currency and % GDP; BOP identity must reconcile. |
| Currency | regime, spot rate/index, exchange pressure, pass-through, intervention capacity, capital mobility | index/rate; explicit quotation convention. |
| Household and firms | consumption propensity, investment sensitivity, confidence, inequality, poverty, business confidence | 0–100 indices or documented elasticities. |
| Capacity and development | infrastructure, human capital, technology, state capacity, health/education/service capacity | 0–100 calibrated indices with component definitions. |
| Resources and climate | energy mix/reserves, food production/security, water, metals, emissions, environmental pressure, climate exposure | physical units and 0–100 indices; list production capacities. |
| Society and governance | public support, trust, legitimacy, stability, protest/riot intensity, regional control, diplomatic trust | 0–100; document thresholds and feedback loops. |

## E. World Economy behaviours, policies and markets

| Dataset / table | Required fields | Required checks |
| --- | --- | --- |
| Country structural coefficients | import propensity, export concentration, fiscal multiplier, price/wage pass-through, interest sensitivities, capital-flow sensitivity, policy credibility, trade elasticity | Value/range, horizon, source/derivation and country-specific rationale. |
| Policy-effect catalogue | policy type, magnitude/unit, decision lag, ramp-up, peak, persistence, decay, side effects, interactions, confidence range | Effects must be gradual, timestamped and attributed; no instant universal effect. |
| Commodity market catalogue | energy, food, metals, industrial goods, technology, shipping, credit and FX: baseline price, supply/demand, inventories, elasticity, transport cost, concentration | Define units, price currency, frequency and market-clearing rule. |
| Trade and contract catalogue | goods/services definitions, quality units, route time/cost, tariff, insurance, deposit/credit, default and penalty rules | Settlement must update trade, reserves, debt and currency consistently. |
| FX and BOP transmission | trade-price pass-through, reserve intervention, swaps, capital controls, debt currency mix, currency-demand relation | Explain managed/fixed/floating regime rules. |
| Project catalogue | project type, cost profile, import share, labour demand, timeline, delay/corruption risk, capacity/productivity effect, maintenance, environmental cost | Project effects must unfold over timestamps/milestones. |
| Route and infrastructure data | ports, straits, rail/road/pipeline/grid nodes, capacities, neighbours, transport time/cost, disruption risk | Required for the fictional map and trade-flow calculations. |

## F. Risk, collapse and continuous-time processing

| Dataset / table | Required fields | Required checks |
| --- | --- | --- |
| Shock library | type, probability/rule, target scope, magnitude distribution, duration, transmission channels, recovery path, random seed policy | Oil, food, capital, climate, disaster, banking, blockade and confidence shocks. |
| Stability escalation model | thresholds/weights for prices, shortages, unemployment, poverty, inequality, trust, legitimacy, debt/default, repression and service failure | Stable → dissatisfaction → demonstrations → riots → crisis → breakdown → fragmentation → collapse → extinction. |
| Recovery/rescue model | aid, restructuring, relief, reforms, stabilisation, rescue package conditions/effects | Must allow recovery but never guarantee it. |
| News/intelligence rules | trigger, source category, confidence, visibility, expiry, later confirmation rule | Keeps fictional World News separate from Daily Brief. |
| Simulation cadence/calibration | real-time cadence, simulated-time multiplier, state update frequency, snapshot cadence, numeric integration/stability rules | Server-side only; must be idempotent and replayable. |
| Historical test scenarios | starting state, timestamped actions/events, expected indicator ranges, expected news/contract outcomes | Regression testing for jobs, replay and duplicate-event protection. |

## Collection priorities

1. Canonical variable dictionary, equation catalogue, parameter catalogue and test vectors for the existing published models.
2. Initial twelve-country state matrix plus country-specific structural coefficients.
3. Policy-effect and market catalogues, including units and time lags.
4. Shock, stability/collapse and project parameter catalogues.
5. Case/EconBench/Arena authored content and curated evidence metadata.

## Copyable collection instruction

> Create a versioned EconMind OS calibration package. Return structured Markdown/CSV-style tables, not unsupported prose. For every value or formula provide its identifier, unit, source or derivation, date/version, assumptions, valid range, uncertainty and a test example. Keep real-world evidence distinct from the fictional twelve-country calibration. Do not invent citations or imply forecasts. Start with the existing published models, then the twelve-country initial state and continuous-time policy/market parameters.
