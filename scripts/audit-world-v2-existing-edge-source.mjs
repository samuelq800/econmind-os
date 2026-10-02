import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
export async function summarizeSource(headers, bytes, slug, repositoryRoot) {
  const types = [...headers.matchAll(/^content-type:\s*([^\r\n]+)/gimu)];
  const contentType = types.at(-1)?.[1];
  if (!contentType?.startsWith("multipart/form-data;"))
    throw new Error("EDGE_SOURCE_FORMAT_UNSUPPORTED");
  const form = await new Response(bytes, {
    headers: { "content-type": contentType },
  }).formData();
  const files = [];
  for (const [field, value] of form.entries()) {
    if (typeof value === "string") continue;
    const contents = Buffer.from(await value.arrayBuffer());
    const source = contents.toString("utf8");
    const filename = value.name.replaceAll("\\", "/");
    const candidates = [filename, field]
      .flatMap((name) => {
        const offset = name.indexOf("supabase/functions/");
        const libraryOffset = name.indexOf("lib/");
        return [
          offset >= 0 ? name.slice(offset) : null,
          libraryOffset >= 0 ? name.slice(libraryOffset) : null,
        ];
      })
      .filter(Boolean);
    let repositoryMatch = null;
    for (const candidate of candidates) {
      const resolved = path.resolve(repositoryRoot, candidate);
      if (!resolved.startsWith(path.resolve(repositoryRoot) + path.sep))
        continue;
      try {
        if (sha256(await readFile(resolved)) === sha256(contents)) {
          repositoryMatch = candidate;
          break;
        }
      } catch {
        /* no match */
      }
    }
    files.push({
      field,
      filename,
      bytes: contents.length,
      sha256: sha256(contents),
      repository_match: repositoryMatch,
      environment_names: [
        ...new Set(
          [...source.matchAll(/Deno\.env\.get\(\s*['"]([A-Z0-9_]+)['"]/gu)].map(
            (match) => match[1],
          ),
        ),
      ].sort(),
      reads_world_database_url: source.includes("WORLD_DATABASE_URL"),
      whole_environment_access: /Deno\.env\.toObject\s*\(|process\.env\b/u.test(
        source,
      ),
      dynamic_environment_access: /Deno\.env\.get\(\s*[^\s'"]/u.test(source),
      dynamic_execution: /\beval\s*\(|new\s+Function\s*\(/u.test(source),
      dynamic_import: /\bimport\s*\(/u.test(source),
    });
  }
  if (files.length === 0) throw new Error("EDGE_SOURCE_FILES_MISSING");
  return {
    slug,
    source_body_sha256: sha256(bytes),
    file_count: files.length,
    secret_visibility: "PROJECT_WIDE",
    files: files.sort((a, b) => a.filename.localeCompare(b.filename)),
  };
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
) {
  const [headersPath, bodyPath, slug, output, repositoryRoot] =
    process.argv.slice(2);
  try {
    const result = await summarizeSource(
      await readFile(headersPath, "utf8"),
      await readFile(bodyPath),
      slug,
      repositoryRoot,
    );
    await writeFile(output, JSON.stringify(result, null, 2) + "\n", {
      flag: "wx",
    });
  } catch {
    console.error("WORLD_V2_EXISTING_EDGE_SOURCE_AUDIT_FAILED");
    process.exitCode = 1;
  }
}
