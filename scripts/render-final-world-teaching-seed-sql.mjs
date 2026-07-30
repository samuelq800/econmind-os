import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();
const directory = resolve(root, "data/final-world-teaching");

const names = (await readdir(directory))
  .filter((name) => name.endsWith(".json"))
  .sort();
const entries = await Promise.all(names.map(async (name) => {
  const raw = await readFile(resolve(directory, name), "utf8");
  return [name.replace(/\.json$/, ""), JSON.parse(raw), raw];
}));
const payload = Object.fromEntries(entries.map(([key, value]) => [key, value]));
const checksum = createHash("sha256").update(entries.map(([, , raw]) => raw).join("\n")).digest("hex");
const version = String(payload.extended_policy_effect_library?.version ?? "0.1.0");
const literal = (value) => `$econmind_final_world$${JSON.stringify(value)}$econmind_final_world$::jsonb`;
const text = (value) => `'${String(value).replaceAll("'", "''")}'`;

console.log(`-- Generated from data/final-world-teaching. Do not edit this output.\n\nbegin;\n\ninsert into public.calibration_packages (package_key, package_version, status, payload, provenance, checksum, validated_at)\nvalues ('final_world_teaching', ${text(version)}, 'validated', ${literal(payload)}, ${literal({ source_directory: "data/final-world-teaching", status: "synthetic_calibration", files: names })}, ${text(checksum)}, timezone('utc', now()))\non conflict (package_key, package_version, checksum) do nothing;\n\nupdate public.calibration_packages\nset status = 'superseded'\nwhere package_key = 'final_world_teaching' and status = 'active' and checksum <> ${text(checksum)};\n\nupdate public.calibration_packages\nset status = 'active', activated_at = timezone('utc', now())\nwhere package_key = 'final_world_teaching' and package_version = ${text(version)} and checksum = ${text(checksum)};\n\nupdate public.continuous_worlds\nset calibration_manifest = calibration_manifest || jsonb_build_object('final_world_teaching', jsonb_build_object('version', ${text(version)}, 'checksum', ${text(checksum)}));\n\ncommit;`);
