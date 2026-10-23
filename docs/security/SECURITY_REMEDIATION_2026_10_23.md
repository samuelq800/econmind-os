# Dependency security remediation — 2026-10-23

## Scope and authority

The project owner requested repository synchronization, investigation of recent
Node.js/CVE vulnerabilities, fixes and deployment. Both local repositories were
fast-forwarded without discarding local files. Website base: `ae64d88480b1755a9610a6ad10c1eb18e6240a7a`.
World simulation checkout: `e7d769e`; its implementation, current gate and production
release permissions are outside this website maintenance change.

This change updates dependencies, local verification and build toolchains. It does
not change economic state, authorization rules, database migrations, Supabase
functions, Cloudflare Worker source/configuration, DNS, mail routing or secrets.
Owners affected: website maintainers, CI/release operators and Worker tooling
maintainers. Existing user-facing legal text and policy versions are unchanged.

## Findings and remediation

| Workspace         | Before: critical/high/moderate/low | After: raw advisories           |
| ----------------- | ---------------------------------- | ------------------------------- |
| Website           | 7 / 27 / 21 / 4                    | 1 high, locally mitigated below |
| Admin mail Worker | 2 / 5 / 11 / 4                     | 0                               |
| Supabase gateway  | 0 / 1 / 0 / 0                      | 0                               |

Counts are advisory entries, not confirmed exploitation or unique vulnerable
production services. Raw before/after JSON reports are retained alongside this file.
The website's production dependency audit reports no known vulnerabilities.

- Node.js 24.20.0 and old CI pins predate the October 21 security release. Local
  verification uses the existing isolated `D:/dev/node/isolated/node-v24.22.1-win-x64`
  installation, with pnpm 11.9.0. All website repository Node workflow pins and
  `.node-version` now use 24.22.1. The global Node installation is not modified.
- Next.js and its lint configuration move from 16.2.10 to 16.4.2, covering the
  published 16.4.1 fixes and subsequent patch. Sharp resolves to 0.35.5 and PostCSS
  to a patched version. React 19.2.7 and the current Supabase SDK were not flagged
  by the dependency audit and remain pinned.
- KaTeX moves to 0.18.2; sanitize-html to 2.18.1. Compatible transitive security
  updates include brace-expansion, browserslist, js-yaml, nanoid and source-map-js.
- Vitest moves to the patched 4.1.12 line, and Vite is explicitly pinned to 7.3.7.
  Both Worker workspaces use Wrangler 4.151.0 and matching Workers types. The newer
  4.152.0 was rejected because of the existing package-age policy; no new age
  exceptions remain. Both Worker findings were in development dependencies;
  deployed runtime dependencies and Worker application code remain unchanged.

### Unreleased braces fix: CVE-2026-93687

The npm audit response suggests braces >=3.0.4, but the registry publishes only
3.0.3 and the upstream advisory explicitly lists no patched version. The committed
pnpm patch caps the actual parser AST stack at 128 nested braces/parentheses before
any recursive compile/expand/stringify walk. It also bounds mixed and unbalanced
input. Quoted, escaped and character-class braces retain their existing meaning.
This is a local mitigation for string patterns consumed by the lint toolchain,
not a claim that an upstream patched release exists or that arbitrary caller-built
AST objects have been hardened.

The raw audit therefore continues to report this high advisory. `pnpm security:check`
fails on every other advisory and verifies the actual installed lint-toolchain
copy rejects over-limit inputs and preserves normal glob behavior. It permits this
one specific dev-only package/version only after those checks pass. No global
audit-ignore list or severity downgrade is introduced. Remove the local patch once
a published upstream fix is available and verified.

## Exposure assessment

The deployed website is a GitHub Pages static export, with images unoptimized and
no public Next.js server, Server Actions endpoint or image optimizer. Those
server-specific advisories do not establish a remotely exploitable Pages service.
The dependency fixes still protect local development, builds and future server
deployments. Browser HTML sanitization is directly relevant to the website.
Cloudflare owns its deployed Workers runtime; a local Node version pin does not
assert that provider-managed runtimes were upgraded.

## Verification

Windows, PowerShell, isolated Node.js 24.22.1, pnpm 11.9.0:

| Command                                                                                                | Exit | Evidence                                                                     |
| ------------------------------------------------------------------------------------------------------ | ---- | ---------------------------------------------------------------------------- |
| `pnpm install --frozen-lockfile` (all three workspaces)                                                | 0    | Frozen installs and package-age policy passed                                |
| `pnpm security:check`                                                                                  | 0    | One raw advisory, one verified local mitigation, zero unmitigated advisories |
| `pnpm audit --prod` (website)                                                                          | 0    | No known vulnerabilities                                                     |
| `pnpm audit` (both Worker workspaces)                                                                  | 0    | No known vulnerabilities                                                     |
| `pnpm exec vitest run --maxWorkers=2 --reporter=json --outputFile=docs/security/tests-2026-10-23.json` | 0    | 134 files; 1114 passed, 1 pre-existing skipped, 0 failed                     |
| `pnpm lint`                                                                                            | 0    | 0 errors, 8 existing warnings                                                |
| `pnpm typecheck`                                                                                       | 0    | Website typecheck                                                            |
| `GITHUB_PAGES=true NEXT_PUBLIC_BASE_PATH="" NEXT_PUBLIC_SITE_URL=https://econmind.group pnpm build`    | 0    | 487 static pages generated                                                   |
| Email Worker `pnpm typecheck`, `pnpm test`, `pnpm build:check`                                         | 0    | 28 tests passed; local dry-run bundle                                        |
| Gateway `pnpm typecheck`, `pnpm build:check`                                                           | 0    | Local dry-run bundle                                                         |
| `actionlint`                                                                                           | 0    | Workflow syntax validation                                                   |
| `git diff --check`                                                                                     | 0    | No whitespace errors                                                         |

Initial failures were corrected without weakening checks: legal source SHA256
checks required canonical LF checkouts on Windows; `.gitattributes` now enforces
that. Email Worker's existing shared `.ts` imports required
`allowImportingTsExtensions` under its already enabled `noEmit` mode. Tests and
source hash manifests were not weakened or changed.

The new CI jobs audit and verify Worker tooling in isolation. Main CI and website
deployment run the dependency-security gate before normal verification. PostgreSQL
integration suites run in existing disposable CI services; they are not claimed
as local executions. No production database write is part of this maintenance
release. The website merge/deployment commit must include `[frontend-only]`, so
the existing Pages workflow skips both database-mutating publication steps.

Remote CI, deployed commit and post-release HTTP evidence are recorded in the PR
and release receipt after completion. No independent P0 approval is asserted.

## Primary sources

- [Node.js October 21 security release](https://nodejs.org/en/blog/vulnerability/october-2026-security-releases): includes high-severity DNS/TLS issues and Brotli RCE CVE-2026-111497; patched LTS 24.22.1.
- [Next.js image optimization RCE advisory](https://github.com/vercel/next.js/security/advisories/GHSA-2464-fhr4-w9xw): fixed in 16.4.1 / Sharp 0.35.5.
- [Next.js cache-function RCE advisory](https://github.com/vercel/next.js/security/advisories/GHSA-673q-mjm6-r5xr): fixed in 16.4.1.
- [Vitest mock registration advisory](https://github.com/vitest-dev/vitest/security/advisories/GHSA-qxg6-89mg-rqv8): backported fix 4.1.12.
- [braces CVE-2026-93687](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm): no published upstream fix at investigation time.
