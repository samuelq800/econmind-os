import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Metadata } from "next";
import { canonicalPageUrl } from "@/lib/seo/routes";
import { publicationBody, renderPolicyMarkdown } from "@/lib/legal/markdown";

export function readPolicySource(file: string) {
  // Server/build-time only; callers pass literal filenames from the allowlist.
  if (!/^[a-z-]+\.md$/.test(file))
    throw new Error("Invalid public policy file");
  return readFileSync(join(process.cwd(), "content/legal", file), "utf8");
}
export function compiledPolicy(file: string) {
  return renderPolicyMarkdown(
    publicationBody(readPolicySource(file), file === "legal-index.md"),
  );
}
export function policyMetadata(
  title: string,
  route: string,
  description: string,
): Metadata {
  return {
    title,
    description,
    alternates: { canonical: canonicalPageUrl(route.replace(/\/$/, "")) },
    openGraph: {
      title,
      description,
      url: canonicalPageUrl(route.replace(/\/$/, "")),
    },
  };
}
