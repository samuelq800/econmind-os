import { describe, expect, it } from "vitest";
import { emailHtmlDocument, sanitizeEmailHtml } from "@/lib/mail/render-html";

describe("untrusted email HTML", () => {
  it("retains useful table formatting and inert embedded images", () => {
    const html = '<table style="width:100%;border-collapse:collapse;margin:0 auto"><tr><td style="background-color:#eef2ee;padding:12px;border-radius:8px">Hello <strong>team</strong><img alt="logo" src="data:image/png;base64,aGVsbG8="></td></tr></table>';
    const result = sanitizeEmailHtml(html);
    expect(result).toContain("<table");
    expect(result).toContain("border-collapse:collapse");
    expect(result).toContain("margin:0 auto");
    expect(result).toContain("<strong>team</strong>");
    expect(result).toContain('src="data:image/png;base64,aGVsbG8="');
  });

  it("removes executable markup, handlers, unsafe links, and CSS resource URLs", () => {
    const result = sanitizeEmailHtml('<script>alert(1)</script><form action="https://bad.test"><input value="secret"></form><a href="javascript:alert(1)" onclick="alert(1)">click</a><p style="color:red;background-image:url(https://bad.test/pixel);position:fixed">body</p><img src="data:image/svg+xml;base64,PHN2Zz4=" alt="svg"><img src="cid:missing" alt="&lt;script&gt;bad&lt;/script&gt;">');
    expect(result).not.toMatch(/<script|<form|<input|javascript:|onclick|background-image|position:fixed|data:image\/svg/i);
    expect(result).toContain("body");
    expect(result).toContain("svg");
    expect(result).toContain("&lt;script&gt;bad&lt;/script&gt;");
  });

  it("blocks remote image URLs until explicitly enabled and keeps CSP isolation", () => {
    const html = '<img src="https://images.example.test/pixel.png" alt="campaign"><img src="//images.example.test/other.png" alt="relative"><a href="https://example.test/page">Read more</a>';
    const blocked = emailHtmlDocument(html);
    expect(blocked).not.toContain("images.example.test/pixel.png");
    expect(blocked).toContain("campaign");
    expect(blocked).toContain("img-src data:");
    expect(blocked).toContain("script-src 'none'");
    expect(blocked).toContain("form-action 'none'");
    const enabled = emailHtmlDocument(html, true);
    expect(enabled).toContain('src="https://images.example.test/pixel.png"');
    expect(enabled).not.toContain("//images.example.test/other.png");
    expect(enabled).toContain("img-src data: https:");
    expect(enabled).toContain('rel="noopener noreferrer nofollow"');
  });
});
