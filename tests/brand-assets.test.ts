import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const layout = readFileSync("app/layout.tsx", "utf8");
const applicationShell = readFileSync("components/layout/application-shell.tsx", "utf8");
const home = readFileSync("components/home/editorial-home.tsx", "utf8");
const navbar = readFileSync("components/layout/navbar.tsx", "utf8");
const footer = readFileSync("components/layout/footer.tsx", "utf8");
const terms = readFileSync("lib/legal/legal-content.ts", "utf8");
const manifest = readFileSync("public/manifest.webmanifest", "utf8");
const serviceWorker = readFileSync("public/sw.js", "utf8");

describe("official EconMind badge", () => {
  it("supplies a crawlable badge icon, manifest, and share image", () => {
    expect(layout).toContain("manifest.webmanifest");
    expect(layout).toContain("econmind-badge-48.png");
    expect(layout).toContain("econmind-badge-192.png");
    expect(layout).toContain("econmind-badge-social.png");
    expect(manifest).toContain("econmind-badge-512.png");
    expect(manifest).toContain('"display": "standalone"');
    expect(manifest).toContain('"shortcuts"');
    expect(applicationShell).toContain("PwaRegistration");
    expect(serviceWorker).toContain("self.addEventListener(\"fetch\"");
  });

  it("uses the official badge in the page-level brand placements", () => {
    expect(home).toContain("EconMind official badge");
    expect(navbar).toContain("econmind-badge-96.png");
    expect(footer).toContain("econmind-badge-96.png");
  });

  it("prevents the interactive brand placements from initiating native image drags", () => {
    expect(home).toMatch(
      /className="home-hero-badge"\s+draggable=\{false\}/,
    );
    expect(navbar).toContain(
      '<Link href="/" className="brand-home-link flex shrink-0 items-center gap-3" onClick={() => setOpen(false)} draggable={false}>',
    );
    expect(navbar).toMatch(
      /draggable=\{false\}\s+className="brand-badge-mini-image"/,
    );
  });

  it("makes the badge copyright and anti-misuse rule visible in the Terms", () => {
    expect(terms).toContain('id: "brand"');
    expect(terms).toContain("badge artwork is protected by copyright");
    expect(terms).toContain("copy, reproduce, modify, crop");
  });
});
