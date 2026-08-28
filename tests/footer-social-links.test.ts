import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const footer = readFileSync("components/layout/footer.tsx", "utf8");

describe("footer social links", () => {
  it("links to every official EconMind social profile", () => {
    for (const href of [
      "https://x.com/EconmindGroup",
      "https://www.xiaohongshu.com/user/profile/69be61b90000000034018bcc",
      "https://www.instagram.com/econmind_os/",
      "https://www.youtube.com/@EconmindGroup",
      "https://www.linkedin.com/in/league-econmind-3a6b68430/",
    ]) {
      expect(footer).toContain(`href: "${href}"`);
    }
  });

  it("presents the profiles as accessible external icon links", () => {
    expect(footer).toContain('aria-label="EconMind social media"');
    expect(footer).toContain('target="_blank"');
    expect(footer).toContain('rel="noopener noreferrer"');
    expect(footer).toContain("opens in a new tab");

    for (const icon of [
      "XIcon",
      "XiaohongshuIcon",
      "InstagramIcon",
      "YouTubeIcon",
      "LinkedInIcon",
    ]) {
      expect(footer).toContain(`function ${icon}()`);
    }
  });

  it("includes the two UHHC partner websites as safe external links", () => {
    expect(footer).toContain('label="Partner websites"');
    expect(footer).toContain('href: "http://www.uhhc.com.cn/"');
    expect(footer).toContain('href: "http://en.uhhc.com.cn/"');
    expect(footer).toContain('label: "UHHC · 简体中文"');
    expect(footer).toContain('label: "UHHC · English"');
    expect(footer).toContain("function ExternalFooterLinks(");
  });
});
