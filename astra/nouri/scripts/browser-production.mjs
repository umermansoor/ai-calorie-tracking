import { finishOnboarding } from "./onboard.mjs";
import { chromium, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
await mkdir("test-results", { recursive: true });
await mkdir("docs/screenshots", { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
    viewport: { width: 1440, height: 1100 },
  }),
  page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
try {
  await page.goto("http://localhost:3000", { waitUntil: "networkidle" });
  await finishOnboarding(page);
  await page.getByRole("button", { name: "You", exact: true }).click();
  await page
    .getByRole("button", { name: "Check remaining credits", exact: true })
    .click();
  await expect(page.getByText(/credits left/)).toBeVisible({ timeout: 15000 });
  await page.getByRole("button", { name: "Today", exact: true }).click();
  await page.screenshot({ path: "docs/screenshots/production.png" });
  await page
    .getByRole("button", { name: "Quick add meal", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Analyze Garden bowl", exact: true }),
  ).toBeVisible();
  const imgFailures = await page.evaluate(() =>
    Array.from(document.images)
      .filter((i) => i.complete && !i.naturalWidth)
      .map((i) => i.src),
  );
  if (imgFailures.length)
    throw Error("Broken images: " + imgFailures.join(","));
  if (errors.length) throw Error("Production console errors");
  console.log("PRODUCTION PASSED; free credits call only");
} catch (e) {
  console.log("FAILED", e.message);
  console.log(await page.locator("body").innerText());
  process.exitCode = 1;
} finally {
  await writeFile(
    "test-results/production-errors.json",
    JSON.stringify(errors),
  );
  console.log("ERRORS", errors);
  await browser.close();
}
