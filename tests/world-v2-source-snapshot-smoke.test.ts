import { expect, it } from "vitest";
// @ts-expect-error Node ESM helper has no declarations.
import { verifySnapshotSmoke } from "../scripts/verify-world-v2-source-snapshot-smoke.mjs";
const headers =
  "HTTP/2 200\r\ncontent-type: application/json\r\ncache-control: no-store\r\nvary: Origin\r\naccess-control-allow-origin: https://samuelq800.github.io\r\nx-world-source-transport: HASH_PINNED_IMMUTABLE_SOURCE_SNAPSHOT\r\n";
const options =
  "HTTP/2 204\r\naccess-control-allow-origin: https://samuelq800.github.io\r\naccess-control-allow-methods: GET, HEAD\r\naccess-control-allow-headers: Accept\r\n";
const body = {
  ok: true,
  packageId: "BALANCED_2026_09_28_V1",
  selectionChecksumSha256:
    "88dd44478f97d2e8893a4f11b3aaf96e256bdb13248aca0d08f097fabe10d315",
  sourceSha256:
    "5d493e93dfab1425731191ba7491cce47949d176e4769b33fdca48d2d31dba89",
  sourcePath: "data/countries.json",
  sourceBytes: 146348,
  dataset: "countries",
  dataNature: "OFFICIAL_SELECTED_SOURCE_DATASET",
  numericEncoding: "DECIMAL_STRING_EXACT",
  liveWorldState: false,
  proposalFieldsAreExecuted: false,
  total: 70,
  offset: 0,
  returned: 1,
  items: [{ synthetic: true }],
};
it("labels snapshot/CORS evidence distinctly from DB connectivity and requires pinned transport", () => {
  expect(verifySnapshotSmoke(headers, body, options)).toMatchObject({
    status: "WORLD_V2_SOURCE_SNAPSHOT_HTTP_AND_CORS_VERIFIED",
    database_projection: false,
  });
  expect(() =>
    verifySnapshotSmoke(
      headers.replace("HASH_PINNED_IMMUTABLE_SOURCE_SNAPSHOT", "DATABASE"),
      body,
      options,
    ),
  ).toThrow();
  expect(() =>
    verifySnapshotSmoke(
      headers.replace("x-world-source-transport", "wrong"),
      body,
      options,
    ),
  ).toThrow();
});
it("retains fixed source, bounded result and exact-origin CORS checks", () => {
  expect(() =>
    verifySnapshotSmoke(
      headers,
      { ...body, sourceSha256: "0".repeat(64) },
      options,
    ),
  ).toThrow();
  expect(() =>
    verifySnapshotSmoke(headers, { ...body, items: [] }, options),
  ).toThrow();
  expect(() =>
    verifySnapshotSmoke(
      headers.replace("https://samuelq800.github.io", "*"),
      body,
      options,
    ),
  ).toThrow();
  expect(() =>
    verifySnapshotSmoke(headers, body, options.replace("204", "200")),
  ).toThrow();
});
