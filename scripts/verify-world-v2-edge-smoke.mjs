import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ORIGIN = "https://samuelq800.github.io";
export function verifySmoke(getHeaders, body, optionsHeaders) {
  const header = (raw, name) =>
    [...raw.matchAll(new RegExp(`^${name}:\\s*([^\\r\\n]*)`, "gimu"))]
      .at(-1)?.[1]
      .trim();
  const status = (raw) =>
    [...raw.matchAll(/^HTTP\/[^\s]+\s+(\d+)/gmu)].at(-1)?.[1];
  if (
    status(getHeaders) !== "200" ||
    status(optionsHeaders) !== "204" ||
    header(getHeaders, "access-control-allow-origin") !== ORIGIN ||
    header(optionsHeaders, "access-control-allow-origin") !== ORIGIN ||
    header(getHeaders, "access-control-allow-credentials") === "true" ||
    header(optionsHeaders, "access-control-allow-credentials") === "true" ||
    !header(getHeaders, "vary")
      ?.split(/\s*,\s*/u)
      .includes("Origin") ||
    header(optionsHeaders, "access-control-allow-methods") !== "GET, HEAD" ||
    header(optionsHeaders, "access-control-allow-headers") !== "Accept" ||
    !header(getHeaders, "content-type")?.startsWith("application/json") ||
    header(getHeaders, "cache-control") !== "no-store" ||
    body.ok !== true ||
    body.packageId !== "BALANCED_2026_09_28_V1" ||
    body.selectionChecksumSha256 !==
      "88dd44478f97d2e8893a4f11b3aaf96e256bdb13248aca0d08f097fabe10d315" ||
    body.sourceSha256 !==
      "5d493e93dfab1425731191ba7491cce47949d176e4769b33fdca48d2d31dba89" ||
    body.sourcePath !== "data/countries.json" ||
    body.sourceBytes !== 146348 ||
    body.dataset !== "countries" ||
    body.dataNature !== "OFFICIAL_SELECTED_SOURCE_DATASET" ||
    body.numericEncoding !== "DECIMAL_STRING_EXACT" ||
    body.liveWorldState !== false ||
    body.proposalFieldsAreExecuted !== false ||
    body.total !== 70 ||
    body.offset !== 0 ||
    body.returned !== 1 ||
    body.items?.length !== 1
  )
    throw new Error("WORLD_V2_EDGE_DATABASE_SMOKE_FAILED");
  return {
    status: "WORLD_V2_EDGE_DATABASE_READ_AND_CORS_VERIFIED",
    dataset: body.dataset,
    package_id: body.packageId,
    selection_sha256: body.selectionChecksumSha256,
    source_sha256: body.sourceSha256,
    returned: body.returned,
    total: body.total,
    origin: ORIGIN,
    live_world_state: false,
  };
}
if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
) {
  const [getPath, bodyPath, optionsPath, output] = process.argv.slice(2);
  try {
    const result = verifySmoke(
      await readFile(getPath, "utf8"),
      JSON.parse(await readFile(bodyPath, "utf8")),
      await readFile(optionsPath, "utf8"),
    );
    await writeFile(output, JSON.stringify(result, null, 2) + "\n", {
      flag: "wx",
    });
  } catch {
    console.error("WORLD_V2_EDGE_DATABASE_SMOKE_FAILED");
    process.exitCode = 1;
  }
}
