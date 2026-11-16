import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { chromium } from "playwright";
import { loadApprovedTemplate, renderCertificate } from "../render.mjs";

const templatePath = process.env.ECONMIND_PRIVATE_CERTIFICATE_TEMPLATE;
const yaleSignaturePath = process.env.ECONMIND_PRIVATE_YALE_SIGNATURE;

test("rejects an unapproved template", async () => {
  await assert.rejects(loadApprovedTemplate(new URL("../package.json", import.meta.url)), /does not match/);
});

test("the second private signature can be selected without altering the template", { skip: !templatePath || !yaleSignaturePath }, async () => {
  const samuel = await renderCertificate({ templatePath, output: "png" });
  const yale = await renderCertificate({ templatePath, output: "png", signatureKey: "yale_chen_v1", yaleSignaturePath });
  assert.notDeepEqual(yale, samuel);
  await assert.rejects(renderCertificate({ templatePath, output: "png", signatureKey: "yale_chen_v1", yaleSignaturePath: templatePath }), /does not match/);
});

test("approved baseline matches pixel-for-pixel and renders a PDF", { skip: !templatePath }, async () => {
  const browser = await chromium.launch({ headless: true });
  let baseline;
  try {
    const page = await browser.newPage({ viewport: { width: 1123, height: 794 }, deviceScaleFactor: 1 });
    await page.route("**/*", route => route.request().url().startsWith("data:") ? route.continue() : route.abort());
    await page.setContent(await readFile(templatePath, "utf8"), { waitUntil: "load" });
    await page.emulateMedia({ media: "print" });
    await page.evaluate(() => document.fonts.ready);
    baseline = await page.locator(".certificate").screenshot({ type: "png", animations: "disabled" });
  } finally { await browser.close(); }
  const rendered = await renderCertificate({ templatePath, output: "png" });
  assert.deepEqual(rendered, baseline);
  const pdf = await renderCertificate({ templatePath, output: "pdf" });
  assert.equal(pdf.subarray(0, 5).toString(), "%PDF-");
  const info = execFileSync("pdfinfo", ["-"], { input: pdf, encoding: "utf8" });
  assert.match(info, /Pages:\s+1\b/);
  const dimensions = info.match(/Page size:\s+([\d.]+) x ([\d.]+) pts/);
  assert.ok(dimensions && Math.abs(Number(dimensions[1]) - 841.89) < 1 && Math.abs(Number(dimensions[2]) - 595.28) < 1);
  await assert.rejects(renderCertificate({ templatePath, fields: { name: "Very long recipient ".repeat(60) } }), /exceeds/);
  await assert.rejects(renderCertificate({ templatePath, fields: { css: "body{display:none}" } }), /Invalid certificate/);
});
