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
    ]) {
      expect(footer).toContain(`function ${icon}()`);
    }
  });
});
