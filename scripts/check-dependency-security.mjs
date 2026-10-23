import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { checkBracesPatch } from "./check-braces-patch.mjs";

assert.ok(process.env.npm_execpath, "Run through pnpm security:check");
const result = spawnSync(
  process.execPath,
  [process.env.npm_execpath, "audit", "--json"],
  {
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
    timeout: 120_000,
  },
);
assert.ifError(result.error);
assert.ok(result.status === 0 || result.status === 1, "Audit command failed");
const audit = JSON.parse(result.stdout);
assert.ok(
  audit.metadata?.vulnerabilities && audit.advisories,
  "Audit response missing evidence",
);
const advisories = Object.values(audit.advisories);
for (const advisory of advisories) {
  // The registry has no upstream release for this advisory. Keep the raw finding
  // visible; accept only this version with our installed, regression-tested patch.
  assert.equal(
    advisory.github_advisory_id,
    "GHSA-vfj7-8cjw-p6xm",
    advisory.url,
  );
  assert.equal(advisory.module_name, "braces");
  assert.ok(advisory.findings.length > 0);
  for (const finding of advisory.findings) {
    assert.equal(finding.version, "3.0.3");
    assert.equal(finding.dev, true);
  }
}
assert.match(
  readFileSync(new URL("../pnpm-workspace.yaml", import.meta.url), "utf8"),
  /braces@3\.0\.3: patches\/braces@3\.0\.3\.patch/,
);
checkBracesPatch();
console.log(
  JSON.stringify({
    result: "PASS",
    rawAdvisories: advisories.length,
    locallyMitigated: advisories.map((advisory) => advisory.github_advisory_id),
    unmitigatedAdvisories: 0,
  }),
);
