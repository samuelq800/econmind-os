// Deliberately allowlisted import. Never copy the archive, its directories,
// DOCX compilations, internal agreements or review evidence into this repository.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
import { createHash } from "node:crypto";

const sources = process.argv[2];
if (!sources)
  throw new Error("Provide the extracted, private source directory");
const league = join(resolve(sources), "league/EconMind_League_Legal_Review_R2");
const world = join(resolve(sources), "world");
const whitelist = [
  ["01_Terms_of_Use.md", "terms.md", "/legal/terms/"],
  ["02_Privacy_Notice.md", "privacy.md", "/legal/privacy/"],
  [
    "03_Community_Guidelines.md",
    "community-guidelines.md",
    "/legal/community-guidelines/",
  ],
  [
    "04_Academic_and_Research_Integrity.md",
    "integrity.md",
    "/legal/integrity/",
  ],
  [
    "05_Intellectual_Property_Policy.md",
    "intellectual-property.md",
    "/legal/intellectual-property/",
  ],
  ["06_Legal_Homepage.md", "legal-index.md", "/legal/"],
  ["07_About_Alignment_Copy.md", "about-alignment.md", "/about/"],
  ["EconMind_World_About.md", "world-about.md", "/legal/world/about/"],
  ["EconMind_World_Terms_of_Use.md", "world-terms.md", "/legal/world/terms/"],
  [
    "EconMind_World_Privacy_Notice.md",
    "world-privacy.md",
    "/legal/world/privacy/",
  ],
];
const checksums = JSON.parse(
  readFileSync(join(league, "SHA256SUMS.json"), "utf8"),
);
const destination = resolve("content/legal");
mkdirSync(destination, { recursive: true });
const manifest = whitelist.map(([sourceName, file, route]) => {
  const isWorld = sourceName.startsWith("EconMind_World_");
  const bytes = readFileSync(
    join(isWorld ? world : join(league, "markdown"), sourceName),
  );
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  if (!isWorld && checksums[`markdown/${sourceName}`] !== sha256)
    throw new Error(`Source checksum mismatch: ${sourceName}`);
  if (existsSync(join(destination, file)))
    throw new Error(`Refusing to overwrite ${file}`);
  writeFileSync(join(destination, file), bytes, { flag: "wx" });
  return {
    sourceName,
    file,
    route,
    sha256,
    sourceEdition: isWorld
      ? "World official documents 2026-10-21"
      : "League review R2 2026-10-21",
    bytes: bytes.length,
  };
});
writeFileSync(
  join(destination, "source-manifest.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
  { flag: "wx" },
);
console.log(
  `Imported exactly ${manifest.length} public source documents, unchanged. Internal files not copied.`,
);
