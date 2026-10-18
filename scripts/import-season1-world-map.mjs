// Import display-only terrain and boundaries; never World state or assignments.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const repository = "samuelq800/econmind-os-world-simulation";
const commit = "1a40309601074fe37fa3526f66a0b5c0beedb308";
const terrainSource =
  "apps/world-web/src/assets/asterra-satellite-terrain-v8.png";
const boundarySource = "apps/world-web/src/map-lab/land-partition.json";
const root = resolve(import.meta.dirname, "..");
const output = join(root, "public/images/season1-countries");
const cache = join(tmpdir(), `econmind-world-map-${commit}`);
mkdirSync(cache, { recursive: true });
mkdirSync(output, { recursive: true });
const fetchSource = async (path) => {
  const response = await fetch(
    `https://raw.githubusercontent.com/${repository}/${commit}/${path}`,
  );
  if (!response.ok)
    throw new Error(`Source unavailable: ${path} ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
};
const [terrainBytes, boundaryBytes] = await Promise.all([
  fetchSource(terrainSource),
  fetchSource(boundarySource),
]);
const partition = JSON.parse(boundaryBytes.toString());
if (
  partition.territories.length !== 70 ||
  partition.territories.some(
    (t, i) => t.number !== String(i + 1).padStart(2, "0"),
  )
)
  throw new Error("Expected 70 ordered display territories");
const original = join(cache, "terrain.png");
const converted = join(cache, "terrain.webp");
writeFileSync(original, terrainBytes);
execFileSync("/opt/homebrew/bin/cwebp", [
  "-quiet",
  "-q",
  "92",
  original,
  "-o",
  converted,
]);
const terrain = readFileSync(converted);
const number = (value) => {
  if (!Number.isFinite(value)) throw new Error("Invalid map coordinate");
  return value;
};
const paths = partition.territories
  .map((t) => {
    if (!/^[MLZ0-9.,\s-]+$/i.test(t.path))
      throw new Error("Unexpected path data");
    return `<path d="${t.path}"/>`;
  })
  .join("");
const labels = partition.territories
  .map(
    (t) =>
      `<text data-country="${t.number}" x="${number(t.label[0])}" y="${number(t.label[1]) + 5}">${t.number}</text>`,
  )
  .join("");
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${number(partition.width)}" height="${number(partition.height)}" viewBox="0 0 ${partition.width} ${partition.height}" role="img" aria-label="Asterra world map with country codes 01 to 70"><title>Asterra · 70-country overview</title><desc>Display-only terrain and numbered country boundaries from the EconMind World repository. Not an official country assignment.</desc><image width="${partition.width}" height="${partition.height}" preserveAspectRatio="none" href="data:image/webp;base64,${terrain.toString("base64")}"/><g fill="none" stroke="#f3d5a1" stroke-opacity=".8" stroke-width="1.1" stroke-linejoin="round">${paths}</g><g text-anchor="middle" font-family="Arial,sans-serif" font-size="17" font-weight="700" fill="#fff0cb" stroke="#041d29" stroke-width="4" paint-order="stroke">${labels}</g></svg>`;
writeFileSync(join(output, "world-map.svg"), svg);
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
writeFileSync(
  join(root, "lib/season1/world-map.json"),
  JSON.stringify(
    {
      repository,
      commit,
      terrainSource,
      boundarySource,
      terrainSourceSha256: hash(terrainBytes),
      boundarySourceSha256: hash(boundaryBytes),
      image: "/images/season1-countries/world-map.svg",
      imageSha256: hash(svg),
      width: partition.width,
      height: partition.height,
      countries: partition.territories.map((t) => t.number),
      notice: "Display only. No official country allocations or runtime data.",
    },
    null,
    2,
  ) + "\n",
);
console.log(
  `Imported world map with ${partition.territories.length} country codes at ${partition.width} × ${partition.height}`,
);
