# Registration reachability repair

The reported mobile registration shows “We could not reach the authentication
service.” The owner reports that login works on international networks. On
2026-10-04, read-only probes from the development machine returned website HTTP
200 and Supabase gateway HTTP 401 without an API key. This establishes that the
services are reachable from this machine; it does not establish reachability
from the affected phone or distinguish its DNS, TLS, carrier and browser behavior.

There was also a confirmed error classification defect: Supabase uses
`AuthRetryableFetchError` for HTTP 5xx responses as well as network failures.
The application now reports those server failures as temporary service
unavailability, while preserving the network message for status 0.

## HTTP transport

The optional `NEXT_PUBLIC_SUPABASE_PROXY_URL=https://supabase.econmind.group`
sends the browser SDK's HTTP requests through a dedicated Cloudflare Worker to
the **same existing Supabase project**. The SDK retains its original project URL,
session storage keys, account isolation and OAuth callbacks. The main account,
Live World and Live Auction clients each use the shared transport while keeping
their existing separate session namespaces. Blank configuration retains direct
HTTP access. Build-time snapshot requests still use the original project URL.

The gateway forwards caller-supplied API keys and user JWTs, never injects
service-role credentials and does not create another database. Supabase still
validates the key, JWT, permissions and RLS. Registration still requires email
verification and the existing consent checks. No SQL, migration, Auth setting,
email template or OAuth-provider configuration changes are required.

The Worker has one fixed upstream and permits the public Auth endpoints and
REST, Storage and Edge Function API prefixes. It rejects Auth admin paths,
unrelated paths, encoded separators, unexpected redirects and unsupported
methods. Browser CORS allows exactly `https://econmind.group`; the API key is
required even when Origin is absent. Origin filtering is not authorization.
Caller cookies and unsolicited headers are not forwarded; response cookies and
upstream CORS headers are removed. Request and response caching is disabled.
No password, OTP, email, token, body or query string is logged; Worker
observability, invocation logs, preview URLs and workers.dev are disabled.
POSTs are forwarded once; there is no failover replay after an ambiguous failure.

The transport does **not** change OAuth navigation, email-link URLs, signed
Storage URLs returned inside JSON, or realtime WebSockets. Email OTP registration,
verification, resend, password login/recovery and SDK HTTP data requests use the
gateway. Google/provider restrictions and realtime connectivity remain separate
limits. Cloudflare reachability on the affected phone must be verified after
rollout; this is not a guarantee of availability on every mainland network.

## Review and rollout

1. Review the code in a PR and pass the source CI, including the dedicated Worker
   type generation, typecheck and dry-run job. Gateway behavior tests run with
   the main test suite. The pinned Worker lockfile is independent of the site.
2. With owner release authorization, run from
   `infra/cloudflare/supabase-gateway`:
   ```powershell
   pnpm install --frozen-lockfile
   pnpm typegen
   pnpm typecheck
   pnpm build:check
   pnpm exec wrangler deploy
   ```
   This publishes only the dedicated Worker and its custom subdomain. Do not
   replace any existing DNS record without reviewing its ownership. The main
   GitHub Pages domain and email Worker are not moved.
3. Probe `/auth/v1/health` and `/auth/v1/settings` on the new domain with the
   existing public API key and `Origin: https://econmind.group`. Check HTTP status,
   exact CORS origin and `Cache-Control: no-store` without logging credentials.
   Confirm the unkeyed request and an unrelated browser Origin are rejected.
4. Set repository variable `NEXT_PUBLIC_SUPABASE_PROXY_URL` to the gateway
   origin and publish the reviewed frontend. The website export first probes the
   configured gateway and fails closed if it is unavailable. Leave
   `NEXT_PUBLIC_SUPABASE_URL` and the public key unchanged.
   **Review the existing Pages workflow's production effects before dispatch:**
   it currently also applies the existing World Chat read API migration. This
   repair does not authorize that SQL or dispatch any production workflow.
5. On the affected mobile network, verify registration with a designated test
   account, delivery of its email OTP, verification, password login, profile load
   and logout. Check an existing session survives the frontend switch. Do not
   register or recover the personal email shown in the report.

Rollback: clear the repository proxy variable and republish the previously
reviewed frontend, subject to the same production-workflow restrictions. Session
storage and project data do not need migration. Then remove only this new
Worker/domain if desired. Do not modify Supabase or the existing email Worker.

## Verification record

Status: `IMPLEMENTED_UNVERIFIED` for the production repair; local source evidence
passes. Verification environment: Windows, isolated Node 22.20.0 under
`D:\dev\node\isolated`, pnpm 11.9.0, frozen site and Worker lockfiles,
Wrangler 4.147.0. The existing mail Worker and system Node were not upgraded.

| Command / check                                                                  | Exit | Result                                                                                      |
| -------------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------------------------- |
| Site `pnpm install --frozen-lockfile`                                            | 0    | Existing lockfile unchanged                                                                 |
| Site `pnpm typecheck`                                                            | 0    | PASS                                                                                        |
| Site `pnpm lint`                                                                 | 0    | PASS, eight existing warnings                                                               |
| Site `pnpm test`                                                                 | 0    | 112 files; 909 passed, one existing skipped test                                            |
| `pnpm exec prettier --check` for all workflows and new/updated formatted sources | 0    | PASS                                                                                        |
| Site `pnpm build`, default configuration                                         | 0    | 474 prerendered pages                                                                       |
| Site `pnpm build`, Pages static export with proxy enabled and a fake public key  | 0    | 474 pages; no production authentication                                                     |
| Worker `pnpm typegen`, `pnpm typecheck`, `pnpm build:check`                      | 0    | Generated binding types, PASS, dry-run only                                                 |
| Local workerd runtime read-only probes                                           | 0    | Unkeyed 401, wrong origin 403, preflight 204, Auth admin 404; upstream rejects fake key 401 |
| Changed-source credential-pattern scan and manual review                         | 0    | No private keys, service-role credentials, production OTP or passwords added                |

The 26 transport/gateway behavior tests include real SDK calls against local
mock responses for signup and OTP verification, retained session keys and OAuth
URLs, cancellation, string/Blob upload compatibility, no write replay, fixed
upstream, CORS, cookie/header filtering, no-store and upstream errors. A subagent
independently reviewed the gateway and transport. Explicit `Request` inputs are
buffered as Blob for mobile compatibility; large explicit streamed uploads can
therefore incur additional memory and cancellation delay. Normal SDK URL plus
string/Blob inputs retain their original body source.

Initial verification exposed Windows `core.autocrlf=true` changing immutable
receipt and fixture bytes. Their canonical Git bytes were restored, without
altering content or expected hashes. `.gitattributes` now preserves LF checkout
for these files and workflows. ESLint excludes Git-ignored backup scripts and
isolated Worker dependencies/generated output; tracked application lint checks
remain active.

Affected owners: website maintainer, Cloudflare zone/Worker owner and Auth
operator. Permissions: caller public key/JWT unchanged, exact-origin CORS;
no service-role binding. Migrations and Supabase configuration changes: none.
Legacy impact: blank proxy configuration keeps direct transport; original
session storage, OAuth and anonymous session namespaces remain intact.

Live Worker deployment, frontend activation, production email delivery and
affected-phone testing remain pending until the release is authorized and run.
CI PostgreSQL jobs also need the PR runner; local source tests do not substitute
for those jobs. No production workflow or SQL was dispatched by this repair.

References: [Cloudflare Request API](https://developers.cloudflare.com/workers/runtime-apis/request/),
[Workers configuration](https://developers.cloudflare.com/workers/wrangler/configuration/),
[Supabase custom domains and OAuth considerations](https://supabase.com/docs/guides/platform/custom-domains).
