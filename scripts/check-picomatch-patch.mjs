import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createRequire } from "node:module";

const blocked = {
  name: "SyntaxError",
  message: "Repeated extglobs are disabled by the local tooling policy",
};

export function checkPicomatchPatch(versions) {
  const workspace = readFileSync("pnpm-workspace.yaml", "utf8");
  const lock = readFileSync("pnpm-lock.yaml", "utf8");
  const store = resolve("node_modules/.pnpm");
  const entries = readdirSync(store);
  const require = createRequire(import.meta.url);
  for (const version of versions) {
    const pkg = `picomatch@${version}`;
    assert.ok(workspace.includes(`  ${pkg}: patches/${pkg}.patch`));
    const lockEntry = lock
      .split("\n")
      .find((line) => line.startsWith(`  ${pkg}: `));
    const digest = lockEntry?.trim().split(": ")[1];
    assert.match(digest ?? "", /^[0-9a-f]{64}$/);
    const copies = entries.filter(
      (entry) => entry === `${pkg}_patch_hash=${digest}`,
    );
    assert.ok(copies.length > 0, `No installed copies of ${pkg}`);
    for (const copy of copies) {
      const match = require(resolve(store, copy, "node_modules/picomatch"));
      // Exercise ordinary repeated groups to verify the local restriction.
      assert.throws(() => match("src/+(draft).ts"), blocked);
      assert.throws(() => match("src/*(draft).ts"), blocked);
      assert.throws(() => match.parse("src/+(draft).ts"), blocked);
      assert.equal(match("src/**/*.ts")("src/components/editor.ts"), true);
      assert.equal(match("src/@(editor|library).ts")("src/editor.ts"), true);
      assert.equal(match("src/@(editor|library).ts")("src/other.ts"), false);
    }
  }
}
