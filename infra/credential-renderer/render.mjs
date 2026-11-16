import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { chromium } from "playwright";

// The visual template, including its original signature, must be provisioned
// privately. It must not be copied into the public website or this repository.
export const APPROVED_TEMPLATE_SHA256 = "591e6c0d67eec9b59ed856f060eca4d3ad5ed8d041b91bf3f67361cf0da6a358";
export const YALE_SIGNATURE_SHA256 = "587af46f950be365383eb8505e77ec072472df5dbc77f6aba734f8ebdf161c53";

export async function loadApprovedTemplate(path) {
  if (!path) throw new Error("A private approved template path is required.");
  const html = await readFile(path, "utf8");
  const hash = createHash("sha256").update(html).digest("hex");
  if (hash !== APPROVED_TEMPLATE_SHA256) throw new Error("Certificate template does not match the approved visual baseline.");
  return html;
}

const selectors = {
  name: ".award-name", role: ".award-role", description: ".award-copy",
  kicker: ".category-kicker", titleFirst: ".title-first", titleMain: ".title-main",
  titleGold: ".title-main .gold", titleSub: ".title-sub",
  scope1: ".scope", scope2: ".scope", scope3: ".scope",
  issueDate: ".footer-cell:nth-child(1) .footer-value",
  certificateId: ".footer-cell:nth-child(2) .footer-value", authority: "#issuingAuthority",
  specimen: ".specimen",
};

/** Text replacements only; never accepts HTML or CSS from a caller. */
export async function renderCertificate({ templatePath, fields = {}, output = "pdf", signatureKey = "samuel_qian_v1", yaleSignaturePath }) {
  for (const [key, value] of Object.entries(fields)) {
    if (!(key in selectors) || typeof value !== "string" || value.length > 4000) throw new Error("Invalid certificate text field.");
  }
  if (!["pdf", "png"].includes(output)) throw new Error("Unsupported output format.");
  if (!["samuel_qian_v1", "yale_chen_v1"].includes(signatureKey)) throw new Error("Unknown signature version.");
  let signatureDataUrl = null;
  if (signatureKey === "yale_chen_v1") {
    if (!yaleSignaturePath) throw new Error("The private Yale signature is not configured.");
    const signature = await readFile(yaleSignaturePath);
    if (createHash("sha256").update(signature).digest("hex") !== YALE_SIGNATURE_SHA256) throw new Error("The private Yale signature does not match its approved version.");
    signatureDataUrl = `data:image/png;base64,${signature.toString("base64")}`;
  }
  const html = await loadApprovedTemplate(templatePath);
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1123, height: 794 }, deviceScaleFactor: 1 });
    await page.route("**/*", route => route.request().url().startsWith("data:") ? route.continue() : route.abort());
    await page.setContent(html, { waitUntil: "load" });
    await page.emulateMedia({ media: "print" });
    const baselineOverflow = await page.evaluate(async () => {
      await document.fonts.ready;
      return [".award-name", ".award-role", ".award-copy", ".cert-heading", ".scope", ".footer-value", "#issuingAuthority"]
        .flatMap(selector => [...document.querySelectorAll(selector)])
        .map(element => ({ horizontal: Math.max(0, element.scrollWidth - element.clientWidth), vertical: Math.max(0, element.scrollHeight - element.clientHeight) }));
    });
    await page.evaluate(async ({ fields, selectors, signatureDataUrl }) => {
      await document.fonts.ready;
      for (const [key, value] of Object.entries(fields)) {
        const element = document.querySelector(selectors[key]);
        if (!element) throw new Error(`Missing approved template field: ${key}`);
        if (key === "titleMain") {
          const first = [...element.childNodes].find(node => node.nodeType === Node.TEXT_NODE);
          if (!first) throw new Error("Missing approved title text node.");
          first.textContent = value;
        } else if (/^scope[123]$/.test(key)) {
          const node = [...element.childNodes].filter(child => child.nodeType === Node.TEXT_NODE)[Number(key.slice(-1)) - 1];
          if (!node) throw new Error("Missing approved scope text node.");
          node.textContent = value;
        } else element.textContent = value;
      }
      if (fields.specimen === "" && fields.certificateId) {
        document.title = `EconMind League Credential ${fields.certificateId}`;
        const description = document.querySelector('meta[name="description"]');
        if (description) description.setAttribute("content", "Official EconMind League credential.");
      }
      document.querySelectorAll("[contenteditable]").forEach(el => el.removeAttribute("contenteditable"));
      if (signatureDataUrl) {
        const signature = document.querySelector(".signature-image");
        if (!(signature instanceof HTMLImageElement)) throw new Error("Missing original signature position.");
        signature.src = signatureDataUrl;
        await signature.decode();
      }
    }, { fields, selectors, signatureDataUrl });
    const problems = await page.evaluate((baseline) => {
      const result = [];
      const certificate = document.querySelector(".certificate");
      const rect = certificate.getBoundingClientRect();
      let index = 0;
      for (const selector of [".award-name", ".award-role", ".award-copy", ".cert-heading", ".scope", ".footer-value", "#issuingAuthority"]) {
        for (const el of document.querySelectorAll(selector)) {
          const bounds = el.getBoundingClientRect();
          const range = document.createRange();
          range.selectNodeContents(el);
          const text = range.getBoundingClientRect();
          const previous = baseline[index++];
          if (el.scrollWidth - el.clientWidth > previous.horizontal + 1 || el.scrollHeight - el.clientHeight > previous.vertical + 1 || text.left < bounds.left - 1 || text.right > bounds.right + 1 || bounds.left < rect.left || bounds.right > rect.right || bounds.bottom > rect.bottom) result.push(selector);
        }
      }
      const bottom = document.querySelector(".award-copy").getBoundingClientRect().bottom;
      if (bottom > document.querySelector(".scope").getBoundingClientRect().top) result.push(".award-copy overlaps scope");
      if (document.querySelector(".award-role").getBoundingClientRect().bottom > document.querySelector(".award-copy").getBoundingClientRect().top) result.push(".award-role overlaps description");
      if (document.querySelector(".cert-heading").getBoundingClientRect().bottom > document.querySelector(".award-intro").getBoundingClientRect().top) result.push(".cert-heading overlaps introduction");
      return result;
    }, baselineOverflow);
    if (problems.length) throw new Error(`Text exceeds the approved certificate layout: ${problems.join(", ")}`);
    if (output === "pdf") return await page.pdf({ format: "A4", landscape: true, printBackground: true, displayHeaderFooter: false, preferCSSPageSize: true });
    return await page.locator(".certificate").screenshot({ type: "png", animations: "disabled" });
  } finally { await browser.close(); }
}
