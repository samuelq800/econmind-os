# World V2 Edge reader readiness — 2026-10-02

Production: **RELEASE_HOLD / WORLD_V2_EDGE_EFFECTIVE_ACCESS_BLOCKED**.
Code review and code merge are separate from release authorization. The release
workflow hard-codes `WORLD_V2_EDGE_PRODUCTION_RELEASE_ALLOWED: "false"` and stops
at its first step, before production contact. A workflow dispatch confirmation
does not override this gate. Unlocking requires a separately reviewed isolation
decision and code change, then a new release authorization.

## Immutable evidence and source

The single authorized read-only readiness collection was
[run 37007399395](https://github.com/samuelq800/econmind-os/actions/runs/37007399395)
at main-site candidate `d931c367b46ffa18716fac359cb75c0df2c9f1cc`.
The job succeeded in collecting evidence; the permission result is **BLOCKED**,
not a successful deployment. Its artifact is
`world-v2-api-reader-readback-audit-evidence`.
No repeat production SQL is needed to establish this recorded blocker.

The reviewed World function is pinned to merged source
`8efe907592006ea5491c341f4c54bed75bfd107f`, function tree
`0e64ed6243ec5d38bfa332b1a601129d329c382b`, 23 files. The workflow copies only
`supabase/functions/world-v2-official-read`, not the World project's config.

| Artifact file                            | SHA256                                                           |
| ---------------------------------------- | ---------------------------------------------------------------- |
| effective-permission-evidence.json       | ba97c4373ba0849c7f4700e51b93802d362f3a6120d837bd0bb1a4822433094e |
| control-plane-evidence.json              | c76dadf1aa46b7e29a6196fe7e37c7d5e7c339cb10eaa206dea95cc818e497df |
| source-brevo-mail-events.json            | 469c04854bd09ac32b262dde3fb5922963501730dad45630c0517a321866a5eb |
| source-collect-daily-economic-brief.json | 891514aa04b477270ab239c26674116490c5f6b307f0825f6b40418faec7a535 |
| source-ingest-admin-email.json           | 0c49c700e9c998cc04ab85e804f2a826a17acc895745322a9c2681e8775e7914 |
| source-moderate-account-access.json      | da4e3480b95f68f271e65fe6f9bf9dfbd8ec14646e1aebbab89abc33a387e8c2 |
| source-process-continuous-world.json     | 07743a43e7b0a8a0ff157a8e6d87a5d5368c42c0718f128f2caa1a2fa62eafb7 |
| source-process-league-world-round.json   | 3bb32759f6829fa097f77d56b64d4e54f2fd4042ca92ee297f1dc0716d21440b |
| source-send-admin-email.json             | 674cfeb6572ba5541fd48c57c718c2ea84061064db35eae836187cd4d77d477d |

## Actual effective-permission blocker

The catalog snapshot covered both roles across 14 non-system schemas,
216 relations and 452 routines. Both `world_v2_api_login` and
`world_v2_api_reader` remained **NOLOGIN**, non-superuser, NOINHERIT,
NOBYPASSRLS, NOCREATEDB, NOCREATEROLE and NOREPLICATION. SET-role closure was
exactly login → login/reader, reader → reader; migration ledger remained 21.
These correct role attributes do **not** remove PUBLIC privileges.

The snapshot's 404 effective entries include 8 intended SELECT columns,
357 routine EXECUTEs, 5 schema USAGEs, 6 sequence privileges and 28 table
privileges. It records PUBLIC schema USAGE on `net`; PUBLIC table SELECT,
INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES and TRIGGER on
`net._http_response` (OID 18423) and `net.http_request_queue` (OID 18416);
and PUBLIC USAGE/SELECT/UPDATE on `net.http_request_queue_id_seq` (OID 18415).
The complete relation ACL also records PUBLIC MAINTAIN on those two tables.
The original 404-entry projection omitted that PostgreSQL 17 privilege;
the final guard now includes it in both preflight and the activation transaction,
with a PostgreSQL 17 fixture proving rejection and retained NOLOGIN. No second
production snapshot is claimed.

The login had 169 reachable routine EXECUTEs, reader 188; each had 140 reachable
SECURITY DEFINER routines. All reachable routine EXECUTEs had a PUBLIC ACL.
Examples include `public.set_league_platform_role(p_user_id uuid, p_platform_role text)`
(OID 18745) and `public.set_live_auction_balance(p_participant_id uuid, p_balance numeric)`
(OID 24865). This establishes excess effective privilege, **not** a demonstrated
business-authentication bypass; routine bodies/business effects were not queried.

PostgreSQL has no per-role negative PUBLIC grant: revoking a direct grant from
these roles cannot negate a grant to PUBLIC. Changing old PUBLIC ACLs or choosing
another isolation path requires a separate review and scope decision. No old ACL
was changed, and no paid service, admin runtime or alternate credential is adopted.

## Control-plane and old-function boundary

The actual transaction PRIMARY pooler was recorded as
`aws-0-ap-northeast-1.pooler.supabase.com:6543`, database `postgres`.
The proposed dedicated username remains
`world_v2_api_login.vimksjrhaxdpnkvgsavz` with TLS required. A connection using
that dedicated role is **NOT_RUN** because it remains NOLOGIN.

All seven old functions remained ACTIVE: collect-daily-economic-brief v26,
process-league-world-round v12, process-continuous-world v13,
moderate-account-access v2, send-admin-email v4, ingest-admin-email v2,
brevo-mail-events v2. Their recorded identities and source-part hashes are
in the artifact; none was redeployed. Twelve existing secret names were observed;
all seven planned WORLD secret names were absent. Secret values were not saved.
Supabase Edge secrets have project-wide visibility, so adding a database URL would
make it available to old functions as well; source evidence is not function-level
secret isolation.

The downloaded multipart sources were parsed in memory, never executed or
extracted into the repository. Lexical summaries found no WORLD_DATABASE_URL
reference, dynamic Deno environment lookup, eval or new Function. A broad
`process.env` match in `lib/base-path.ts` was only static NEXT_PUBLIC_BASE_PATH and
GITHUB_PAGES access; the final auditor distinguishes those properties. Path
normalization now handles `functions/*` and `<slug>/*`, correcting false unmatched
summaries. Independent B hash reconciliation found the brevo/ingest shared
`admin-mail.ts` hash `98611bd4d44db3106d3d0f460281d83023f4a9b410def0099d2f900f73e8ed74`
matches historical git source
`db8bbdc86a625c4f02cccc41fcb0b0b6d27db039:supabase/functions/_shared/admin-mail.ts`;
it is not the current helper. B found no environment lookup or dynamic execution
in that historical blob. This bounded provenance check is not a full security
audit or a guarantee against all future secret access.

## Fail-closed code and verification contract

The shared effective-permission projection covers schema USAGE/CREATE, all table
privileges (including MAINTAIN on PostgreSQL 17+), column privileges, sequences,
routine EXECUTE and extra SET-role targets. Only the exact existing eight-column
read allowlist passes. Disposable PostgreSQL CI checks the valid baseline and
single activation, rejects a second activation, and checks PUBLIC table, column,
MAINTAIN, SECURITY DEFINER and extra SET-role negative cases in both preflight and
the transaction, retaining NOLOGIN after rejection. These tests do not contact
production.

Future deployment verification must read the **database-backed** countries route
with `limit=1`, validate the fixed package/selection/source hashes, exact-decimal
encoding, 70 total rows and one returned item, and validate GET plus OPTIONS CORS
for the exact Pages origin. A static catalogue HTTP 200 is insufficient.
Only the non-secret verified summary is uploaded; response data/credentials are not.
The smoke code is implemented and unit tested; live routed read/CORS is **NOT_RUN**.

No LOGIN/password activation, WORLD secrets set, new Edge deployment or UI switch
occurred. The selected bundle remains `IMPLEMENTED_UNVERIFIED_CANDIDATE`,
`activation_allowed=false`. Worker, OpeningSeed, settlement and Gate B are unchanged.
Production release remains **HOLD** even if B approves code merge and CI is green.
