import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { verifySmoke } from "./verify-world-v2-edge-smoke.mjs";
export function verifySnapshotSmoke(headers, body, options) {
  const verified = verifySmoke(headers, body, options);
  const value = [
    ...headers.matchAll(/^x-world-source-transport:\s*([^\r\n]+)/gimu),
  ]
    .at(-1)?.[1]
    .trim();
  if (value !== "HASH_PINNED_IMMUTABLE_SOURCE_SNAPSHOT")
    throw new Error("SNAPSHOT_TRANSPORT_HEADER_INVALID");
  const { status, ...metadata } = verified;
  void status;
  return {
    ...metadata,
    status: "WORLD_V2_SOURCE_SNAPSHOT_HTTP_AND_CORS_VERIFIED",
    source_transport: value,
    database_projection: false,
  };
}
if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
) {
  const [headers, body, options, out] = process.argv.slice(2);
  try {
    await writeFile(
      out,
      JSON.stringify(
        verifySnapshotSmoke(
          await readFile(headers, "utf8"),
          JSON.parse(await readFile(body, "utf8")),
          await readFile(options, "utf8"),
        ),
        null,
        2,
      ) + "\n",
      { flag: "wx" },
    );
  } catch {
    console.error("WORLD_V2_SOURCE_SNAPSHOT_SMOKE_FAILED");
    process.exitCode = 1;
  }
}
