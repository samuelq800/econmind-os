import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";

const root = process.argv[2] || "out";
const manifest = JSON.parse(
  readFileSync("content/legal/source-manifest.json", "utf8"),
);
const routes = [
  ...manifest.map((entry) => entry.route),
  "/legal/world/",
  "/legal/previous/terms/",
  "/legal/previous/privacy/",
];
const results = [];
let checkedLinks = 0;
for (const route of routes) {
  const html = readFileSync(join(root, route, "index.html"), "utf8");
  assert(html.includes("<h1"), `Missing page title ${route}`);
  if (!route.includes("previous")) {
    assert(
      !html.includes("Proposed version 2.0"),
      `Review preamble leaked ${route}`,
    );
    assert(
      !html.includes("Review revision R2 dated"),
      `Review preamble leaked ${route}`,
    );
    const canonical = `https://econmind.group${route}`;
    assert(
      html.includes(`rel="canonical" href="${canonical}"`),
      `Canonical missing ${route}`,
    );
  }
  const links = [...html.matchAll(/<a\b[^>]*href="([^"<>]*)"/g)].map((match) =>
    match[1].replaceAll("&amp;", "&"),
  );
  for (const link of links) {
    if (!link.startsWith("/") && !link.startsWith("#")) continue;
    const url = new URL(link, `https://econmind.group${route}`);
    const pathname = decodeURIComponent(url.pathname);
    const target = join(
      root,
      pathname.endsWith("/")
        ? `${pathname}index.html`
        : pathname.includes(".")
          ? pathname
          : `${pathname}/index.html`,
    );
    assert(existsSync(target), `Broken internal link ${route}: ${link}`);
    if (url.hash && !url.search) {
      const targetHtml = readFileSync(target, "utf8");
      assert(
        targetHtml.includes(`id="${decodeURIComponent(url.hash.slice(1))}"`),
        `Missing anchor ${route}: ${link}`,
      );
    }
    checkedLinks++;
  }
  results.push({ route, valid: true, links: links.length });
}
for (const [old, current] of [
  ["terms", "terms"],
  ["privacy", "privacy"],
  ["integrity", "integrity"],
  ["community-guidelines", "community-guidelines"],
]) {
  const html = readFileSync(join(root, old, "index.html"), "utf8");
  assert(
    html.includes(`/legal/${current}/`),
    `Missing legacy compatibility ${old}`,
  );
}
const forbidden =
  /(?:08_Contributor_License|09_Internal_Governance|10_Chinese_Review|11_Clause_Comparison|12_Rights_and_Licensing|13_Compliance_and_Implementation|14_Decision_Traceability|15_Audit_Response|01_Public_Policies_EN\.docx|02_Internal_Agreements_EN\.docx|03_Review_and_Comparison_ZH\.docx|EconMind_League_Legal_Review_20261021_R2\.zip)/;
let inspected = 0;
function inspect(directory) {
  for (const item of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, item.name);
    assert(
      !forbidden.test(path),
      `Forbidden internal source filename: ${path}`,
    );
    if (item.isDirectory()) inspect(path);
    else if (/\.(html|txt|js|json|map|md)$/.test(item.name)) {
      assert(
        !forbidden.test(readFileSync(path, "utf8")),
        `Forbidden internal source reference: ${path}`,
      );
      inspected++;
    }
  }
}
inspect(root);
console.log(
  JSON.stringify(
    {
      results,
      checkedInternalLinks: checkedLinks,
      inspectedBuildFiles: inspected,
      internalFilesExposed: 0,
      legacyCompatibilityPages: 4,
    },
    null,
    2,
  ),
);
