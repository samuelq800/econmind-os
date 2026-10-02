# World V2 official-read Edge Function — controlled release candidate

Status: **RELEASE_HOLD / EFFECTIVE_ACCESS_BLOCKED / NOT AUTHORIZED FOR PRODUCTION DISPATCH**. This
candidate builds on the separately verified 0021 database reader publication
([run `36672349466`](https://github.com/samuelq800/econmind-os/actions/runs/36672349466)).
It does not replay 0021, change World opening state, start a worker, or approve
Gate B. The selected bundle remains `IMPLEMENTED_UNVERIFIED_CANDIDATE` with
`activation_allowed=false`.

The [2026-10-02 readiness receipt](WORLD_V2_EDGE_READER_READINESS_2026_10_02.md)
records the actual excess PUBLIC privileges and unchanged NOLOGIN roles.
The workflow's first-step hard-coded production HOLD prevents all release contact;
code merge does not unlock it. A separately reviewed isolation decision and code
change, followed by new release authorization, are required. There is no per-role
negative PUBLIC revoke shortcut; old ACL changes remain out of scope.

## Fixed connection contract

- New function only: `world-v2-official-read`. Its public base URL is
  `https://vimksjrhaxdpnkvgsavz.supabase.co/functions/v1/world-v2-official-read`;
  the existing API path follows unchanged, for example
  `/v1/world-data/datasets`. The seven currently deployed functions are not
  touched. Only this new function has `verify_jwt=false`; its handler must
  enforce exact public GET/HEAD/OPTIONS routes and origin policy.
- The server-side connection is a newly generated password for the existing
  `world_v2_api_login` role, which is currently NOLOGIN and already has the
  reviewed `SET ROLE` membership in the frozen NOLOGIN
  `world_v2_api_reader`. The controlled operation checks the exact 0021 ledger,
  role attributes, membership, SET ROLE closure and effective catalog
  privileges (including PUBLIC) before one `ALTER ROLE ... LOGIN PASSWORD`.
  It does not grant additional privileges or use `postgres`, `service_role`,
  `anon`, or a browser key at runtime.
- The Edge connection uses this project's **shared transaction pooler**, port
  6543, with username `world_v2_api_login.vimksjrhaxdpnkvgsavz`, TLS
  required, one client connection per warm isolate, no prepared statements,
  and fixed read-only SQL in a read-only transaction. The pooler host must be
  taken from the project's actual connection configuration, not guessed from
  its region. Supabase documents [the custom-role username, port and pooler
  limits](https://supabase.com/docs/guides/database/connecting-to-postgres).
- `WORLD_DATABASE_URL` and the non-public reader configuration are set only as
  [Edge Function secrets](https://supabase.com/docs/guides/functions/secrets):
  `WORLD_API_DB_LOGIN_ROLE`, `WORLD_API_DB_READER_ROLE`,
  `WORLD_DATABASE_FINGERPRINT`, `WORLD_DATABASE_NAMESPACE`,
  `WORLD_DATABASE_MUTATION_MODE`, and
  `WORLD_API_OFFICIAL_PUBLIC_ORIGINS`. Their names currently do not collide
  with existing remote secrets. Supabase Edge secrets are project-wide, not
  isolated to one function; this release must not put the URL in GitHub Pages
  source, build variables, artifacts, or logs.

## Future controlled path, only after separately resolving production HOLD

1. A finishes the World repository's reviewed, deterministic self-contained
   Edge function directory. E pins the exact merged World commit and function
   tree OID in
   `.github/workflows/release-world-v2-edge-reader.yml`. The reviewed World
   source is now merged at `8efe907592006ea5491c341f4c54bed75bfd107f` with
   function tree `0e64ed6243ec5d38bfa332b1a601129d329c382b`. CI and B must
   review the final effective-permission guard and this credential-operation
   diff before publication.
2. With a separate one-time release authorization, the main-site workflow
   checks the fixed target, unused slug and secret names, real transaction
   pooler configuration, and read-only 0021/NOLOGIN baseline. The existing
   GitHub control-plane token is used only by this workflow. No password or
   token is printed or included in an artifact.
3. The runner generates a fresh high-entropy password in its temporary
   directory, sets only the seven new server-side secrets, verifies their
   names, then executes exactly one guarded role activation request. It
   verifies role state without querying the password. If activation is
   uncertain, it performs a read-only diagnostic and stops; no automatic
   retry or deployment follows.
4. Only after role verification does the workflow deploy the one new
   function, verify its active slug and `verify_jwt=false`, and perform a
   bounded database-backed countries read (`limit=1`) with exact source/selection
   hashes, count and numeric encoding, plus GET and OPTIONS CORS for the exact
   Pages origin. A static catalogue HTTP 200 is insufficient. D can then use the
   public function base URL in Pages only after these routed checks pass.

No new service subscription or paid feature is requested. Edge invocations
and database connections still consume the existing project's quotas. The
main-site generic `deploy-supabase.yml` remains unchanged and cannot deploy
this new function by its current explicit function list.

## Fail-closed states

- A mismatched role, membership, ledger, pooler mode/host/port, existing
  secret name, or existing function slug stops before credential generation.
- A partially completed secret set stops before LOGIN activation. Operators
  must inspect names and obtain a reviewed recovery decision; rerunning this
  one-time path is intentionally blocked by the collision check.
- LOGIN verified but function deployment failed is **not** a connected API.
  Preserve that state and review a deploy-only recovery using the already
  registered server secret; never generate a second password or replay 0021
  automatically.
- A successful Edge response is source-data availability only. It does not
  prove published map URLs, authorized World state, settlement, worker
  operation, OpeningSeed, or Gate B.
