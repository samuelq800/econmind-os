import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { checkBracesPatch } from "./check-braces-patch.mjs";
import { checkMinimatchSafety } from "./check-minimatch-safety.mjs";

/** Every exceptional classification requires actual installed-code checks.
 * Registry input alone cannot grant an exception or mark a package safe. */
export function assessDependencyAdvisories(advisories) {
  const minimatch = checkMinimatchSafety();
  checkBracesPatch();
  const locallyMitigated = [];
  const notApplicable = [];
  for (const advisory of advisories) {
    assert.ok(advisory.findings.length > 0);
    if (advisory.github_advisory_id === "GHSA-vfj7-8cjw-p6xm") {
      // No upstream braces release; retain only the installed/tested local patch.
      assert.equal(advisory.module_name, "braces");
      for (const finding of advisory.findings) {
        assert.equal(finding.version, "3.0.3");
        assert.equal(finding.dev, true);
      }
      locallyMitigated.push(advisory.github_advisory_id);
    } else if (advisory.github_advisory_id === "GHSA-g3hv-75wg-m249") {
      // The advisory's broad <11.0.1 registry range includes legacy 3, whose
      // exact installed source has no aggressive optimizer or cloning pass.
      // Modern 10 MUST be upgraded; never accept an affected modern finding.
      assert.equal(advisory.module_name, "minimatch");
      for (const finding of advisory.findings) {
        assert.equal(finding.version, "3.1.5");
        assert.equal(finding.dev, true);
      }
      notApplicable.push({
        advisory: advisory.github_advisory_id,
        version: minimatch.legacy.version,
        sourceSha256: minimatch.legacy.sha256,
        reason: "PINNED_LEGACY_SOURCE_HAS_NO_AGGRESSIVE_OPTIMIZATION_PASS",
      });
    } else {
      assert.fail(
        `Unreviewed dependency advisory: ${advisory.github_advisory_id} ${advisory.url}`,
      );
    }
  }
  return {
    locallyMitigated,
    notApplicable,
    modernMinimatch: minimatch.modern.version,
  };
}

function main() {
  assert.ok(process.env.npm_execpath, "Run through pnpm security:check");
  const result = spawnSync(
    process.execPath,
    [process.env.npm_execpath, "audit", "--json"],
    { encoding: "utf8", maxBuffer: 16 * 1024 * 1024, timeout: 120_000 },
  );
  assert.ifError(result.error);
  assert.ok(result.status === 0 || result.status === 1, "Audit command failed");
  const audit = JSON.parse(result.stdout);
  assert.ok(
    audit.metadata?.vulnerabilities && audit.advisories,
    "Audit response missing evidence",
  );
  const advisories = Object.values(audit.advisories);
  const assessment = assessDependencyAdvisories(advisories);
  assert.match(
    readFileSync(new URL("../pnpm-workspace.yaml", import.meta.url), "utf8"),
    /braces@3\.0\.3: patches\/braces@3\.0\.3\.patch/,
  );
  console.log(
    JSON.stringify({
      result: "PASS",
      rawAdvisories: advisories.length,
      ...assessment,
      unmitigatedAdvisories: 0,
    }),
  );
}

if (
  process.argv[1] &&
  existsSync(process.argv[1]) &&
  realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)
)
  main();
