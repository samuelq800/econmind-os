# World Economy: operating model

## What the simulation is

World Economy is a persistent fictional twelve-country teaching simulation. It uses a real clock, not quarterly buttons, round timers or a forced end date. Each worker tick applies calibrated policy lags, current contracts, active shocks and the country’s own economic state. The original **Economic Sandbox** and **Daily Brief** remain separate: neither writes to the shared world.

## Entry and ownership

1. Every participant first creates an individual EconMind account.
2. To join World Economy, the participant must also be an active member of an approved League school Team.
3. A Team Captain claims one available fictional country. A school may operate more than one Team, with each Team controlling a different country.
4. A country is operational once it has a Captain. Countries that have not been claimed keep their supplied default calibration and are not manually adjusted.

There are seven portfolios: Country Captain; Central Bank Governor; Economic Policy Minister; Trade Minister; Infrastructure & Investment Minister; Social & Labour Minister; and Research & Innovation Minister. A participant can hold several or all portfolios in the Team’s country. The Captain may perform every permitted country action; each other portfolio is restricted to its own instruments.

## Policies, debt and stability

Policy changes are proposals with a documented lag, ramp, peak and duration. They can be amended or cancelled before they expire. The interface makes clear that a tax increase can improve fiscal capacity later rather than instantly. Budget deficits are allowed: their consequences appear through the state dynamics—debt, risk, inflation, investment and social stability—not through an arbitrary hard block.

Country states move from normal conditions through protest and government crisis to institutional collapse or an empty state only when calibrated risk thresholds are met. Collapse is serious but not permanent: the stability rules include recovery paths and the worker can record re-entry after persistent improvement. Events and worker snapshots are immutable replay evidence; users cannot create or edit snapshots.

## Trade and contracts

The Trade Minister drafts a template-backed contract. The exporter’s Captain approves it and the importer’s Trade Minister or Captain approves it. A scheduled agreement then moves through delivery and invoice stages against natural time. The worker records late payment, default notice, cure, restructuring and force-majeure states from the supplied settlement rules. Original contract terms are retained; GCU conversion is dated rather than overwriting the original currency.

## Shocks, rankings and supervision

The engine may schedule disclosed, deterministic automatic shocks based on the calibration library. Teachers, League administrators and platform administrators may inject a bounded shock; normal players respond but cannot inject one. Rankings are a rolling composite of current outcome indicators rather than a one-off round score. The page exposes the result components and risk feedback so a rank cannot be mistaken for a complete welfare measure.

## Learning systems outside League

- **Model Practice** presents versioned questions with only Correct/Incorrect, unlimited retries and optional step hints. It has no partial score and no AI marking.
- **Model Composer** connects two to four existing models, checks units, assumptions and feedback boundaries, and never alters the World Economy. All users can save private drafts; teachers and platform administrators can publish reusable compositions.
- **EconBench** contains ten fixed multi-model policy challenges. A result is correct only when each stored condition passes.
- **Mechanism Design Arena** contains ten fully described mechanisms. Any bot-like behavior is deterministic and stated in the scenario; there is no external AI service.
- **Evidence Lab** exposes three curated read-only teaching samples and source links. Data upload is intentionally unavailable.

## Security and cost boundary

All participant data lives behind Supabase RLS. The browser receives only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`; it never receives the service-role key. The protected worker credential stays inside Supabase Edge Functions and scheduled calls. The design uses GitHub Pages, Supabase PostgreSQL/Auth/Edge Functions and built-in scheduling only, keeping the initial deployment within the free-tier-oriented stack.
