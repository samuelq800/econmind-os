# GHSA-g3hv-75wg-m249 dependency repair

The live registry reports CVE-2026-118764 for minimatch `<11.0.1`.
The official advisory describes minimatch 10.2.6's `optimizationLevel >= 2`
preprocessor: `**/..` can repeatedly clone `globParts`, followed by quadratic
pairwise deduplication. The installed modern dependency was reached through
`eslint-config-next → typescript-eslint → typescript-estree → minimatch`.

- [Official advisory](https://github.com/advisories/GHSA-g3hv-75wg-m249)
- [Upstream fix](https://github.com/isaacs/minimatch/commit/77a0f5c4b80bdc641c3c930a1d9edf5ad2db57f8)

The workspace override replaces only `minimatch@10.2.6` with official **11.0.1**.
It does not replace the callable CommonJS minimatch 3 API used by ESLint and its
legacy plugins. The modern caller in the locked `typescript-estree` package is
`minimatch(filePath, pattern, {dot:true})` in `useProgramFromProjectService.js`;
that API remains available. Version 11 intentionally removes `makeRe`, which
this modern caller does not use. Legacy `makeRe`, callable/default functions and
`defaults` remain covered against the unchanged legacy package. No other direct
dependency or unrelated lockfile version was updated.

The bounded trigger was reproduced before upgrading: eight repeated
`**/../a/b` segments with `optimizationLevel:2, braceExpandMax:8` generated
**256** patterns in 10.2.6. The fixed implementation generates **8**; a second
pattern and limit produce **16**, and a 2000-entry set skips quadratic dedupe
while preserving positive/negative matches. Ordinary TS/JS glob and dot-file
behavior is also checked. These are small deterministic cases, not an unbounded
load test.

The registry's broad range also reports **3.1.5**. This is not treated as a
general exemption for minimatch 3. The exact installed legacy source SHA-256 is
`746849f267c4868a53729225bd85c7dccd387712136fb305fcc0a3eadd4a3d9d`.
It contains no `optimizationLevel`, `firstPhasePreProcess` or
`secondPhasePreProcess` and builds `globParts` with a one-to-one `globSet.map`.
The same trigger yields one set and one parts entry; there is no cloning pass.
The checker verifies the hash of every installed 3.1.5 copy, the actual ESLint
resolution, the absent optimizer and this trigger. This source-specific
non-applicability applies only to this advisory, exact version and bytes.

`security:check` retains the raw advisory count and reports this legacy result
separately as `notApplicable`. It rejects an affected modern version, a different
legacy version, a production finding, another package or a new advisory. It
continues to require the existing installed braces parser patch and regression;
that protection was not removed when the current registry stopped reporting
the older braces finding.

Run using Node 24.22.1 and pnpm 11.9.0:

```sh
pnpm install --frozen-lockfile
pnpm exec vitest run tests/dependency-security.test.ts
pnpm security:check
pnpm lint
pnpm typecheck
node scripts/check-minimatch-safety.mjs
```

The live `pnpm audit --json` result may still contain the exact legacy finding;
it is retained rather than rewritten as a clean audit. Package graph, advisory
input, applicability evidence and tests must be reviewed together. Unknown
findings or changed installed source fail the check. No deployment, merge or
production approval follows from this local dependency repair.
