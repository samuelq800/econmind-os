import assert from "node:assert/strict";
import { createRequire } from "node:module";

// Resolve the copy actually consumed by Next's lint tooling, including pnpm's patch.
export function checkBracesPatch() {
  let require = createRequire(import.meta.url);
  for (const name of [
    "eslint-config-next",
    "@next/eslint-plugin-next",
    "fast-glob",
    "micromatch",
  ]) {
    require = createRequire(require.resolve(name));
  }
  const braces = require("braces");
  for (const method of ["parse", "compile", "expand", "stringify"]) {
    for (const [open, close] of [
      ["{", "}"],
      ["(", ")"],
      ["{(", ")}"],
    ]) {
      assert.throws(
        () => braces[method](open.repeat(129) + "a" + close.repeat(129)),
        {
          name: "SyntaxError",
          message: "Pattern nesting exceeds maximum depth (128)",
        },
      );
      assert.throws(() => braces[method](open.repeat(129) + "a"), {
        name: "SyntaxError",
        message: "Pattern nesting exceeds maximum depth (128)",
      });
    }
    assert.doesNotThrow(() =>
      braces[method]("{".repeat(128) + "a" + "}".repeat(128)),
    );
  }
  assert.deepEqual(braces.expand("src/{app,lib}/{a,b}.ts"), [
    "src/app/a.ts",
    "src/app/b.ts",
    "src/lib/a.ts",
    "src/lib/b.ts",
  ]);
  assert.deepEqual(braces.expand("x/{1..3}"), ["x/1", "x/2", "x/3"]);
  assert.doesNotThrow(() => braces.parse('"' + "{".repeat(256) + '"'));
  assert.doesNotThrow(() => braces.parse("[" + "{".repeat(256) + "]"));
  assert.doesNotThrow(() => braces.parse("\\{".repeat(256)));
}
