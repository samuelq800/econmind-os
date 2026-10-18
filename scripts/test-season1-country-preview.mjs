import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE ?? "playwright"
);
const browser = await chromium.launch({ headless: true });
const output =
  process.env.COUNTRY_SCREENSHOTS ?? "/tmp/econmind-country-preview";
mkdirSync(output, { recursive: true });
const url = "http://localhost:3047/season1/countries/preview";
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const failures = [];
page.on("pageerror", (error) => failures.push(error.message));
await page.goto(url, { waitUntil: "networkidle" });
assert.equal(
  await page
    .getByRole("navigation", { name: "Season 1", exact: true })
    .getByRole("link", { name: "My Team", exact: true })
    .getAttribute("href"),
  "/season1/my-team",
);
assert.equal(
  await page
    .getByRole("link", { name: "Country Selection", exact: true })
    .getAttribute("aria-current"),
  "page",
);
await page
  .getByRole("img", { name: /Asterra world map from EconMind/ })
  .waitFor();
await page.waitForFunction(() => {
  const image = document.querySelector(".s1-world-map img");
  return image?.complete && image.naturalWidth > 0;
});
await page.screenshot({
  path: `${output}/desktop-world-map.png`,
  fullPage: true,
});
await page.getByRole("button", { name: "Explore countries" }).click();
const dialog = page.getByRole("dialog");
await dialog.waitFor({ state: "visible" });
assert.equal(await dialog.locator(".s1-country-card").count(), 70);
assert.equal(await dialog.locator(".s1-country-card:disabled").count(), 0);
assert.equal(
  await dialog.getByRole("button", { name: /02 Brelis/ }).isDisabled(),
  false,
);
await page.waitForFunction(() => {
  const img = document.querySelector(".s1-country-detail img");
  return img?.complete && img.naturalWidth > 0;
});
await page.screenshot({ path: `${output}/desktop-selection.png` });
await dialog.getByRole("searchbox").fill("Zorin");
assert.equal(await dialog.locator(".s1-country-card").count(), 1);
await dialog.getByRole("searchbox").fill("");
await dialog.getByRole("button", { name: "52 Zorin, available" }).click();
await dialog
  .getByRole("button", { name: "Confirm country preference" })
  .click();
await dialog.waitFor({ state: "hidden" });
assert.match(await page.getByRole("status").textContent(), /52.*Zorin.*saved/);
await page.getByLabel("Recruitment locked", { exact: true }).uncheck();
assert.equal(
  await page.locator(".s1-country-selected").getByText("52 · Zorin").count(),
  0,
);
await page.getByLabel("Recruitment locked", { exact: true }).check();
await page.getByRole("button", { name: "Explore countries" }).click();
await dialog.getByLabel("Country code", { exact: true }).fill("1");
assert.equal(
  await dialog.getByLabel("Country code", { exact: true }).inputValue(),
  "01",
);
await dialog
  .getByRole("button", { name: "Confirm country preference" })
  .click();
await dialog.waitFor({ state: "hidden" });
await page
  .getByRole("combobox", { name: "Demo member count" })
  .selectOption("2");
assert.equal(
  await page.locator(".s1-country-selected").getByText("01 · Avenor").count(),
  0,
);
await page.getByRole("button", { name: "Explore countries" }).click();
assert.equal(
  await dialog
    .getByRole("button", { name: "Confirm country preference" })
    .isDisabled(),
  true,
);
await page.keyboard.press("Escape");
await page
  .getByRole("combobox", { name: "Demo member count" })
  .selectOption("4");
await page.getByLabel("Captain view", { exact: true }).uncheck();
await page.getByRole("button", { name: "Explore countries" }).click();
assert.equal(
  await dialog
    .getByRole("button", { name: "Confirm country preference" })
    .isDisabled(),
  true,
);
await page.keyboard.press("Escape");
await page.getByLabel("Captain view", { exact: true }).check();
await page.getByLabel("Simulate competing selection", { exact: true }).check();
await page.getByRole("button", { name: "Explore countries" }).click();
await dialog.getByLabel("Country code", { exact: true }).fill("44");
await dialog
  .getByRole("button", { name: "Confirm country preference" })
  .click();
assert.match(
  await dialog.getByRole("alert").textContent(),
  /already been selected/,
);
assert.equal(
  await dialog.getByRole("button", { name: "44 Ruvan, reserved" }).isDisabled(),
  true,
);
await dialog.getByLabel("Country code", { exact: true }).fill("70");
await dialog
  .getByRole("button", { name: "Confirm country preference" })
  .click();
await dialog.waitFor({ state: "hidden" });
await page.screenshot({ path: `${output}/desktop-saved.png`, fullPage: true });
assert.deepEqual(failures, []);

const mobile = await browser.newPage({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  deviceScaleFactor: 2,
  hasTouch: true,
});
await mobile.goto(url, { waitUntil: "networkidle" });
await mobile.screenshot({
  path: `${output}/mobile-world-map.png`,
  fullPage: true,
});
await mobile.getByRole("button", { name: "Explore countries" }).click();
const md = mobile.getByRole("dialog");
await mobile.waitForFunction(() => {
  const img = document.querySelector(".s1-country-detail img");
  return img?.complete && img.naturalWidth > 0;
});
assert.equal(
  await mobile.evaluate(
    () => document.documentElement.scrollWidth <= innerWidth,
  ),
  true,
);
assert.equal(await md.evaluate((e) => e.scrollWidth <= e.clientWidth), true);
await mobile.screenshot({ path: `${output}/mobile-selection.png` });
await md.getByRole("searchbox").fill("Rhea");
await md.getByRole("button", { name: "70 Rhea, available" }).click();
await mobile.screenshot({ path: `${output}/mobile-card.png` });
await md.getByRole("button", { name: "Confirm country preference" }).click();
await md.waitFor({ state: "hidden" });
assert.match(await mobile.getByRole("status").textContent(), /70.*Rhea.*saved/);
await browser.close();
console.log(
  "PASS: desktop/mobile, 70 cards, disabled reserved choices, search, save, code entry, automatic release, eligibility, competing reservation, no overflow",
);
console.log(`Screenshots: ${output}`);
