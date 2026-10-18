// Display assets only. Never imports World runtime, economic data or assignments.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";

const repository = "samuelq800/econmind-os-world-simulation";
const commit = "1a40309601074fe37fa3526f66a0b5c0beedb308";
const source = "apps/world-web/src/assets/country-scenes";
const root = resolve(import.meta.dirname, "..");
const cache = join(tmpdir(), `econmind-country-scenes-${commit}`);
const output = join(root, "public/images/season1-countries");
const catalogPath = join(root, "lib/season1/country-catalog.json");
mkdirSync(cache, { recursive: true });
mkdirSync(output, { recursive: true });
mkdirSync(resolve(catalogPath, ".."), { recursive: true });
const get = (path) =>
  execFileSync(
    "gh",
    [
      "api",
      `repos/${repository}/contents/${path}?ref=${commit}`,
      "-H",
      "Accept: application/vnd.github.raw+json",
    ],
    { maxBuffer: 16 * 1024 * 1024 },
  );
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const indexBytes = get(`${source}/index.json`);
const index = JSON.parse(indexBytes.toString());
if (
  index.length !== 70 ||
  index.some(
    (entry, i) =>
      entry.number !== String(i + 1).padStart(2, "0") ||
      entry.file !== `${entry.number}.png`,
  )
)
  throw new Error("Expected exactly countries 01–70 in order");
const entries = [];
let cursor = 0;
await Promise.all(
  Array.from({ length: 4 }, async () => {
    while (cursor < index.length) {
      const entry = index[cursor++];
      const original = join(cache, entry.file);
      if (!existsSync(original)) {
        const response = await fetch(
          `https://raw.githubusercontent.com/${repository}/${commit}/${source}/${entry.file}`,
        );
        if (!response.ok)
          throw new Error(`Image fetch failed: ${response.status}`);
        writeFileSync(original, Buffer.from(await response.arrayBuffer()));
      }
      const bytes = readFileSync(original);
      if (bytes.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a")
        throw new Error(`Not PNG: ${entry.file}`);
      const full = join(output, `${entry.number}.webp`);
      const thumb = join(output, `${entry.number}-thumb.webp`);
      execFileSync("/opt/homebrew/bin/cwebp", [
        "-quiet",
        "-q",
        "90",
        original,
        "-o",
        full,
      ]);
      execFileSync("/opt/homebrew/bin/cwebp", [
        "-quiet",
        "-q",
        "82",
        "-resize",
        "480",
        "0",
        original,
        "-o",
        thumb,
      ]);
      entries.push({
        code: entry.number,
        name: entry.name,
        image: `/images/season1-countries/${entry.number}.webp`,
        thumbnail: `/images/season1-countries/${entry.number}-thumb.webp`,
        width: bytes.readUInt32BE(16),
        height: bytes.readUInt32BE(20),
        originalSha256: hash(bytes),
        imageSha256: hash(readFileSync(full)),
        thumbnailSha256: hash(readFileSync(thumb)),
      });
      console.log(`Imported ${entry.number} ${entry.name}`);
    }
  }),
);
entries.sort((a, b) => a.code.localeCompare(b.code));
writeFileSync(
  catalogPath,
  JSON.stringify(
    {
      repository,
      commit,
      source,
      indexSha256: hash(indexBytes),
      notice:
        "Illustrated planning scenes. Display only, not authoritative World country assignments.",
      countries: entries,
    },
    null,
    2,
  ) + "\n",
);
