import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(".github/workflows/deploy-pages.yml", "utf8");
const layout = readFileSync("app/layout.tsx", "utf8");
const authDialog = readFileSync("components/auth/auth-dialog.tsx", "utf8");

describe("custom-domain deployment", () => {
  it("exports GitHub Pages at the custom-domain root", () => {
    expect(workflow).toContain('NEXT_PUBLIC_BASE_PATH: ""');
    expect(workflow).toContain('NEXT_PUBLIC_SITE_URL: "https://econmind.group"');
  });

  it("uses the canonical domain for metadata without hard-coded project URLs", () => {
    expect(layout).toContain("process.env.NEXT_PUBLIC_SITE_URL");
    expect(layout).toContain("https://econmind.group");
    expect(layout).not.toContain("samuelq800.github.io/econmind-os");
  });

  it("derives email confirmation redirects from the configured base path", () => {
    expect(authDialog).toContain('import { BASE_PATH } from "@/lib/base-path"');
    expect(authDialog).not.toContain('startsWith("/econmind-os")');
  });
});
