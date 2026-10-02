import { expect, it } from "vitest";
// @ts-expect-error The smoke verifier is a Node ESM module.
import { verifySmoke } from "../scripts/verify-world-v2-edge-smoke.mjs";

const getHeaders =
  "HTTP/2 200\r\ncontent-type: application/json; charset=utf-8\r\ncache-control: no-store\r\nvary: Origin\r\naccess-control-allow-origin: https://samuelq800.github.io\r\n";
const optionsHeaders =
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
it("requires the DB-backed bounded response and exact CORS contract", () => {
  expect(verifySmoke(getHeaders, body, optionsHeaders).status).toBe(
    "WORLD_V2_EDGE_DATABASE_READ_AND_CORS_VERIFIED",
  );
  expect(() =>
    verifySmoke(
      getHeaders,
      { ok: true, datasets: [], databaseAvailability: "VERIFY_PER_REQUEST" },
      optionsHeaders,
    ),
  ).toThrow();
  expect(() =>
    verifySmoke(
      getHeaders,
      { ...body, sourceSha256: "0".repeat(64) },
      optionsHeaders,
    ),
  ).toThrow();
  expect(() =>
    verifySmoke(
      getHeaders.replace("https://samuelq800.github.io", "*"),
      body,
      optionsHeaders,
    ),
  ).toThrow();
  expect(() =>
    verifySmoke(getHeaders, { ...body, items: [] }, optionsHeaders),
  ).toThrow();
});
