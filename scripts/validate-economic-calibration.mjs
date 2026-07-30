import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();
const calibrationDirectory = resolve(root, "data/economic-calibration");
const strict = process.argv.includes("--strict");
const expected = [
  "package_metadata.json",
  "variable_dictionary.csv",
  "world_country_calibration.json",
  "market_baselines.json",
  "policy_effect_library.json",
  "shock_library.json",
  "stability_rules.md",
  "sources.md",
];

const fileNames = new Set(await readdir(calibrationDirectory).catch(() => []));
const missing = expected.filter((file) => !fileNames.has(file));
const jsonFiles = [...fileNames].filter((file) => file.endsWith(".json"));
const parseFailures = [];
for (const file of jsonFiles) {
  try { JSON.parse(await readFile(resolve(calibrationDirectory, file), "utf8")); }
  catch (error) { parseFailures.push(`${file}: ${error instanceof Error ? error.message : "invalid JSON"}`); }
}

const metadata = fileNames.has("package_metadata.json")
  ? JSON.parse(await readFile(resolve(calibrationDirectory, "package_metadata.json"), "utf8"))
  : null;
const declaredMissing = Object.keys(metadata?.files ?? {}).filter((file) => !fileNames.has(file));

for (const file of missing) console.error(`ERROR required file missing: ${file}`);
for (const message of parseFailures) console.error(`ERROR JSON parse failed: ${message}`);
for (const file of declaredMissing) console.warn(`WARN package manifest declares a future file that is not present yet: ${file}`);
console.log(`Calibration files: ${fileNames.size}; JSON parsed: ${jsonFiles.length - parseFailures.length}/${jsonFiles.length}.`);

if (missing.length || parseFailures.length || (strict && declaredMissing.length)) process.exitCode = 1;
