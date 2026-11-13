import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { existsSync, readFileSync, readdirSync, realpathSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const legacySourceSHA256 =
  "746849f267c4868a53729225bd85c7dccd387712136fb305fcc0a3eadd4a3d9d";

/** Resolve the implementations actually consumed by ESLint and TypeScript's
 * parser, rather than testing an unrelated top-level minimatch installation. */
export function inspectMinimatchSafety() {
  const root = createRequire(import.meta.url);
  const legacyRequire = createRequire(root.resolve("eslint"));
  let modernRequire = root;
  for (const name of [
    "eslint-config-next",
    "typescript-eslint",
    "@typescript-eslint/typescript-estree",
  ]) {
    modernRequire = createRequire(modernRequire.resolve(name));
  }
  const legacy = legacyRequire("minimatch");
  const modern = modernRequire("minimatch");
  const legacyPath = legacyRequire.resolve("minimatch");
  const source = readFileSync(legacyPath, "utf8");
  // Include every installed copy of this exact legacy version. Do not extend
  // the applicability decision to arbitrary minimatch 3 versions or patches.
  const store = realpathSync(new URL("../node_modules/.pnpm", import.meta.url));
  const legacyCopies = readdirSync(store)
    .filter((name) => /^minimatch@3\.1\.5(?:_|$)/u.test(name))
    .sort()
    .map((name) => {
      const path = join(store, name, "node_modules/minimatch/minimatch.js");
      return {
        path,
        sha256: createHash("sha256").update(readFileSync(path)).digest("hex"),
      };
    });
  const pattern = Array(8).fill("**/../a/b").join("/");
  const aggressive = { optimizationLevel: 2, braceExpandMax: 8 };
  const older = new legacy.Minimatch(pattern, aggressive);
  const newer = new modern.Minimatch(pattern, aggressive);
  const large = new modern.Minimatch("{x,*}/{0..999}", {
    optimizationLevel: 2,
  });
  const alternate = new modern.Minimatch(
    Array(10).fill("**/../c/d").join("/"),
    { optimizationLevel: 2, braceExpandMax: 16 },
  );
  return {
    legacy: {
      version: legacyRequire("minimatch/package.json").version,
      path: legacyPath,
      sha256: createHash("sha256").update(source).digest("hex"),
      copies: legacyCopies,
      hasAggressiveOptimizer:
        "firstPhasePreProcess" in legacy.Minimatch.prototype ||
        "secondPhasePreProcess" in legacy.Minimatch.prototype ||
        source.includes("optimizationLevel"),
      oneToOnePartsMap: source.includes(
        "set = this.globParts = set.map(function (s) {",
      ),
      globSetCount: older.globSet.length,
      globPartsCount: older.globParts.length,
      normalControls: [
        legacy("src/a.ts", "src/**/*.ts"),
        !legacy("src/a.js", "src/**/*.ts"),
        legacy.makeRe("src/*.{ts,tsx}").test("src/b.tsx"),
        legacy.defaults({ dot: true })(".hidden", "*"),
      ],
    },
    modern: {
      version: modernRequire("minimatch/package.json").version,
      path: modernRequire.resolve("minimatch"),
      generatedPatterns: newer.set.length,
      requestedLimit: aggressive.braceExpandMax,
      alternateGeneratedPatterns: alternate.set.length,
      alternateRequestedLimit: 16,
      largeNonQuadraticSet: large.set.length,
      normalControls: [
        modern.minimatch("src/a.ts", "src/**/*.ts"),
        !modern.minimatch("src/a.js", "src/**/*.ts"),
        // typescript-estree's actual modern call is named minimatch(...,
        // {dot:true}); minimatch 11 intentionally no longer exports makeRe.
        modern.minimatch(".hidden.ts", "*.ts", { dot: true }),
        large.match("x/5"),
        large.match("y/999"),
        !large.match(".y/5"),
        new modern.Minimatch("**/../a/b/**/../c/d", {
          optimizationLevel: 2,
        }).match("x/a/b/y/c/d"),
      ],
    },
    advisory: "GHSA-g3hv-75wg-m249",
    upstreamFix:
      "https://github.com/isaacs/minimatch/commit/77a0f5c4b80bdc641c3c930a1d9edf5ad2db57f8",
  };
}

export function checkMinimatchSafety() {
  const evidence = inspectMinimatchSafety();
  assert.equal(evidence.legacy.version, "3.1.5");
  assert.equal(evidence.legacy.sha256, legacySourceSHA256);
  assert.ok(evidence.legacy.copies.length > 0);
  assert.ok(
    evidence.legacy.copies.some((copy) => copy.path === evidence.legacy.path),
  );
  for (const copy of evidence.legacy.copies)
    assert.equal(copy.sha256, legacySourceSHA256);
  assert.equal(evidence.legacy.hasAggressiveOptimizer, false);
  assert.equal(evidence.legacy.oneToOnePartsMap, true);
  assert.equal(evidence.legacy.globSetCount, 1);
  assert.equal(evidence.legacy.globPartsCount, 1);
  assert.ok(evidence.legacy.normalControls.every(Boolean));
  assert.equal(evidence.modern.version, "11.0.1");
  assert.equal(evidence.modern.generatedPatterns, 8);
  assert.equal(evidence.modern.alternateGeneratedPatterns, 16);
  assert.equal(evidence.modern.largeNonQuadraticSet, 2000);
  assert.ok(evidence.modern.normalControls.every(Boolean));
  return evidence;
}

if (
  process.argv[1] &&
  existsSync(process.argv[1]) &&
  realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  assert.ok(
    process.argv.length === 2 ||
      (process.argv.length === 3 && process.argv[2] === "--diagnose"),
    "USAGE: check-minimatch-safety.mjs [--diagnose]",
  );
  console.log(
    JSON.stringify(
      process.argv[2] === "--diagnose"
        ? inspectMinimatchSafety()
        : checkMinimatchSafety(),
      null,
      2,
    ),
  );
}
