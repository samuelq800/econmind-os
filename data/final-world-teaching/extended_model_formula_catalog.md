# Extended model formula catalog

Version 0.1.0 · 2026-07-30 · Formula definitions are `derived`; numerical parameter values and tests are `synthetic_calibration` unless a source explicitly says otherwise. This catalog adds the final-specification model coverage without changing the existing base catalog in `../economic-calibration/model_formula_catalog.md`.

Every row supplies a formula, symbols and units, scope, numerical check, and chart contract. The linked test suite is the machine-readable source of the test inputs/outputs and the practice bank materializes six binary questions per model.

## Notation and common safeguards

Currency is GCU, prices are GCU/unit, quantities are units per period, rates are decimal per compatible period, and percentages are percentage points unless marked `%`. A formula must not mix monthly and annual rates without a documented conversion. All comparative statics are conditional on their listed assumptions; causal interpretation requires a separate identification design.

Authoritative/open teaching routes: [CORE The Economy](https://www.core-econ.org/the-economy/) (micro, macro, trade and game theory), [IMF debt dynamics note](https://www.imf.org/-/media/websites/imf/imported-full-text-pdf/external/pubs/ft/tnm/2010/_tnm1002.pdf), [Econometrics with R](https://www.econometrics-with-r.org/) (OLS through IV), and [Causal Inference: The Mixtape](https://mixtape.scunning.com/) (DiD, RDD, IV). These are also indexed in [sources.md](sources.md).

## Labour, information and collective-action models

| Model ID | Formula; symbols and units | Assumptions / boundary | Numerical check; interactive chart | Source |
|---|---|---|---|---|
| `labour_market` | `L_d=a-bw`, `L_s=c+dw`; `w` GCU/hour, `L` workers | Competitive, homogeneous labour; not monopsony | `100-2w=20+w` gives `w=26.667,L=46.667`; chart `w` vs `L_d,L_s` | CORE |
| `monopsony` | `w(L)=a+bL`; `ME=a+2bL`; hire where `MRP=ME` | One wage-setting employer, upward-sloping labour supply | `MRP=30,a=5,b=.1`: `L=100,w=15`; chart `MRP,ME,w` vs L | CORE |
| `public_goods` | `pi_i=e_i-c_i+(m/n)Σc_j` | `1<m<n` creates free-rider incentive | `e=10,n=4,m=1.6,c=10 each`: `pi=16`; chart total contribution/payoff | CORE |
| `common_pool_resources` | `S'=S+rS(1-S/K)-Σh_i` | Stock cannot go below zero; harvested units observable | `S=100,r=.3,K=200,H=40`: `S'=75`; chart stock transition vs harvest | CORE |
| `information_asymmetry` | `E[v\|signal]=Σp(type\|signal)v_type` | Signal is imperfect; common priors known | `.7*100+.3*40=82`; chart posterior against signal precision | CORE |
| `adverse_selection` | `P_pool=E[p_i L]+loading` | Types privately known before purchase | risks `.1,.4`, loss 100, equal shares: fair premium `25`; chart premium vs entrant mix | CORE |
| `moral_hazard` | choose effort `e` to maximize `u(w- premium - effort_cost + coverage*loss)` | Effort unobservable after insurance/contract | loss probability drops `.4→.3`, effort cost 2: prevention value `10>2`; chart coverage vs effort | CORE |
| `signalling` | separating condition `c_H(s)-c_H(0) < wage_H-wage_L < c_L(s)-c_L(0)` | Signal cost differs by type; employers observe signal | gap 20, high cost 5, low cost 25: `s` can separate; chart signal cost by type | CORE |

## Macroeconomics, money and finance

| Model ID | Formula; symbols and units | Assumptions / boundary | Numerical check; interactive chart | Source |
|---|---|---|---|---|
| `keynesian_multiplier` | `ΔY=kΔG`, `k=1/(1-c(1-t)+m)` | Short-run demand slack; leakages are `t,m` | `c=.75,t=.2,m=.1`: `k=1.429`; `ΔG=10→ΔY=14.29`; chart c vs k | CORE |
| `monetary_policy` | `i_t=r*+π_t+φπ(π_t-π*)+φy ygap_t` | Policy-rule approximation, not a commitment | `r*=1,π=4,π*=2,φπ=.5,φy=.5,ygap=-1`: `i=1.5`; chart inflation/output gap reaction surface | CORE |
| `fiscal_policy` | `ΔY=k_GΔG+k_TΔT`, usually `k_T=-c k_G` in simple model | Fixed prices/interest rate in short run | `c=.75,k_G=1.5,ΔG=10,ΔT=4`: `ΔY=10.5`; chart fiscal impulse vs output | CORE |
| `public_debt` | `d_t=((1+r_t)/(1+g_t))d_(t-1)-pb_t` | `d` debt/GDP, `pb` primary surplus/GDP; same period rates | `d=.80,r=.06,g=.03,pb=.01→d'=0.8133`; chart r-g vs debt path | IMF |
| `business_cycle` | `y_gap=(Y-Y_p)/Y_p`; Okun form `Δu=-βΔy_gap` | Potential output estimate uncertain | `Y=98,Yp=100→-2%`; β=.4 and gap rise 2pp → `Δu=-.8pp`; chart output gap/unemployment | CORE |
| `money_market` | `M/P=L(Y,i)=kY-hi`; equilibrium `M/P=L` | Price level predetermined short run | `M/P=100,k=.5,Y=240,h=10→i=2`; chart real balances and money demand | CORE |
| `loanable_funds` | `S(r)=I(r)+DEF`; equilibrium rate clears funds | Closed-economy simplification; no bank balance sheet | `S=20+2r,I=80-3r,DEF=10→r=14`; chart S and I+DEF | CORE |
| `bank_credit_creation` | `ΔD=(1/rr)ΔR` (textbook upper bound) | Excess reserves, capital and cash leakages ignored | `rr=.1,ΔR=10→max ΔD=100`; chart reserve ratio vs multiplier | CORE |

## International economics

| Model ID | Formula; symbols and units | Assumptions / boundary | Numerical check; interactive chart | Source |
|---|---|---|---|---|
| `comparative_advantage` | opportunity cost `OC_X=a_LX/a_LY`; specialise in lower OC | Two goods, constant unit labour coefficients | A: `2/4=.5`, B:`6/3=2`; A has X advantage; chart PPFs | CORE |
| `tariffs` | domestic price `P_w(1+t)`; revenue `tP_w*M` | Small-country partial equilibrium; no quota rent | `Pw=10,t=.2,M=50`: P=12, revenue=100; chart supply/demand wedge | CORE |
| `quotas` | rent `(P_q-P_w)*quota`; imports fixed at quota | Licence allocation specified; otherwise distribution unknown | `Pq=14,Pw=10,Q=50`: rent=200; chart import quota gap | CORE |
| `exchange_rates` | log return `Δe=100 ln(e_t/e_(t-1))`; positive means depreciation when e=local/foreign | Quote convention must remain fixed | e `2→2.2`: depreciation `9.531%`; chart e and inflation pass-through | IMF |
| `balance_of_payments` | `CA+KA+FA+EO=ΔR` under stated sign convention | Accounting identity; signs must be configured once | CA=-3, KA=0, FA=5, EO=0 ⇒ `ΔR=2`; chart components waterfall | IMF |
| `marshall_lerner` | depreciation improves TB after adjustment if `|ε_x|+|ε_m|>1` | Elasticities are long-run, nonzero trade flows | `.8+.6=1.4>1`; chart elasticity sum threshold | IMF |
| `j_curve` | `TB(t)=price_effect(t)+volume_effect(t-lag)` | Contracts/prices precede volume response; not universal | price effect -2 now, volume +3 after 3 months: `TB0=-2,TB3=+1`; chart TB over time | IMF |
| `purchasing_power_parity` | relative PPP `Δs≈π-π*`; absolute PPP `s=P/P*` | Tradables and common basket; weak short-run guide | π=6%,π*=2% ⇒ predicted depreciation ≈4%; chart inflation differential vs FX | IMF |

## Operations, risk and expectation

| Model ID | Formula; symbols and units | Assumptions / boundary | Numerical check; interactive chart | Source |
|---|---|---|---|---|
| `newsvendor` | `F(Q*)=Cu/(Cu+Co)=(p-c)/(p-s)` | One period, known demand distribution, no stockout substitution | p=12,c=5,s=1 ⇒ `.6364`; normal μ=100 σ=20 gives Q≈107; chart expected profit by Q | CORE |
| `inventory_optimisation` | EOQ `Q*=sqrt(2DS/H)` | Stable demand, no stockouts, constant order/holding cost | D=1200,S=20,H=2 ⇒ `Q*=154.919`; chart total annual cost vs Q | CORE |
| `demand_forecasting` | `F_(t+1)=αD_t+(1-α)F_t` | Level process; α fixed 0..1 | α=.3,D=120,F=100 ⇒ 106; chart actual and forecast | CORE |
| `insurance_risk_pooling` | `E[claims]=Σp_i L_i`; solvency capital must cover tail loss | Independent losses in simple benchmark; correlation breaks pooling | four risks .1,.1,.4,.4; L=100 ⇒ expected claims=100; chart pool size vs variance | CORE |
| `expected_value` | `E[X]=Σp_i x_i` | Mutually exclusive exhaustive outcomes; risk neutrality for choice | `.6*10+.4*(-5)=4`; chart probability vs payoff | CORE |

## Econometrics and uncertainty

| Model ID | Formula; symbols and units | Assumptions / boundary | Numerical check; interactive chart | Source |
|---|---|---|---|---|
| `ols` | `βhat=(X'X)^(-1)X'y` (one x: Cov(x,y)/Var(x)) | Exogeneity `E[u\|X]=0`; functional form | x=[1,2,3],y=[2,4,6] ⇒ slope=2; scatter + fitted line | EWR |
| `multiple_regression` | `y=β0+β1x1+β2x2+u`; β1 is conditional association | No perfect multicollinearity; exogeneity | y=1+2x1+3x2 exact ⇒ coefficients [1,2,3]; partial-regression plot | EWR |
| `fixed_effects` | `y_it=α_i+τ_t+βx_it+u_it`; demean within i | Removes only time-invariant unit confounders | worker changes x 1→3, y 5→7 ⇒ within slope 1; within scatter | EWR |
| `difference_in_differences` | `δ=(ȳ_T,post-ȳ_T,pre)-(ȳ_C,post-ȳ_C,pre)` | Parallel trends absent treatment; no spillovers | T 10→14,C 10→11 ⇒ δ=3; group-time lines | Mixtape |
| `logit` | `Pr(Y=1\|X)=1/(1+e^(-Xβ))`; log-odds `Xβ` | Independent observations/adequate specification | Xβ=0 ⇒ p=.5; Xβ=ln(3) ⇒ p=.75; probability curve | EWR |
| `rdd` | `τ=lim(x↓c)E[Y\|x]-lim(x↑c)E[Y\|x]` | No precise sorting; potential outcome smooth at cutoff | right mean 12,left 10 at c ⇒ τ=2; scatter/local fits | Mixtape |
| `iv` | `β_IV=Cov(Z,Y)/Cov(Z,X)` (one endogenous regressor) | Relevance, exclusion, independence, monotonicity where LATE | Cov(Z,Y)=6,Cov(Z,X)=3 ⇒ β=2; first-stage/reduced-form plot | Mixtape |
| `confidence_intervals` | `(estimate ± critical_value*SE)` | Sampling/large-sample or stated distribution assumptions | β=2,SE=.5,z=1.96 ⇒ [1.02,2.98]; coefficient interval plot | EWR |

## Boundary rules and tests

- All formulas use the units stated above. Convert annual to monthly simple rates only with `r_month=(1+r_annual)^(1/12)-1`, and record the method.
- Formulas are not policy guarantees. The engine uses their results only inside physical, budget, inventory, and governance constraints.
- See [extended_model_test_suite.json](extended_model_test_suite.json) for machine assertions and [extended_practice_question_bank.json](extended_practice_question_bank.json) for the six binary question generators per model.
