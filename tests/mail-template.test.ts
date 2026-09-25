import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { renderAdminMailHtml } from "../supabase/functions/_shared/mail-template";

describe("branded outgoing mail", () => {
  it("escapes authored text while preserving line breaks and the official badge", () => {
    const html = renderAdminMailHtml('Hello <script>alert("x")</script> & team\nSecond line');
    expect(html).toContain("https://econmind.group/brand/econmind-badge-96.png");
    expect(html).toContain("EconMind");
    expect(html).toContain("Hello &lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; team<br>Second line");
    expect(html).not.toContain("<script>");
  });

  it.each(["confirmation", "recovery"])("keeps the %s security email code and link", (name) => {
    const html = readFileSync(`supabase/templates/${name}.html`, "utf8");
    expect(html).toContain("https://econmind.group/brand/econmind-badge-96.png");
    expect(html).toContain("EconMind");
    expect(html).toContain("{{ .Token }}");
    expect(html).toContain('href="{{ .ConfirmationURL }}"');
  });
});
