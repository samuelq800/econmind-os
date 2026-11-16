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
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1123, height: 794 }, deviceScaleFactor: 1 });
    await page.setContent(await readFile(templatePath, "utf8")); await page.emulateMedia({ media: "print" });
    const signatureBox = await page.evaluate(() => {
      const root = document.querySelector(".certificate").getBoundingClientRect();
      const signature = document.querySelector(".footer-signature").getBoundingClientRect();
      return { left: signature.left-root.left, top: signature.top-root.top, right: signature.right-root.left, bottom: signature.bottom-root.top };
    });
    const bounds = await page.evaluate(async ({ first, second }) => {
      async function pixels(base64) {
        const image = new Image(); image.src = `data:image/png;base64,${base64}`; await image.decode();
        const canvas = document.createElement("canvas"); canvas.width = image.width; canvas.height = image.height;
        const context = canvas.getContext("2d"); context.drawImage(image, 0, 0); return { data: context.getImageData(0, 0, image.width, image.height).data, width: image.width };
      }
      const a = await pixels(first), b = await pixels(second); let left = a.width, right = 0, top = 10000, bottom = 0, count = 0;
      for (let i=0; i<a.data.length; i+=4) if (a.data[i]!==b.data[i] || a.data[i+1]!==b.data[i+1] || a.data[i+2]!==b.data[i+2] || a.data[i+3]!==b.data[i+3]) {
        const x=(i/4)%a.width,y=Math.floor((i/4)/a.width); left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);count++;
      }
      return {left,right,top,bottom,count};
    }, { first: samuel.toString("base64"), second: yale.toString("base64") });
    assert.ok(bounds.count > 0 && bounds.left >= signatureBox.left-2 && bounds.right <= signatureBox.right+2 && bounds.top >= signatureBox.top-2 && bounds.bottom <= signatureBox.bottom+2, JSON.stringify({bounds, signatureBox}));
  } finally { await browser.close(); }
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
  const multilingual = await renderCertificate({ templatePath, fields: { name: "示例用户", role: "Research Contributor", description: "For sustained contributions to research, collaboration and the development of EconMind League." }, output: "pdf" });
  assert.equal(multilingual.subarray(0, 5).toString(), "%PDF-");
  await assert.rejects(renderCertificate({ templatePath, fields: { css: "body{display:none}" } }), /Invalid certificate/);
});
