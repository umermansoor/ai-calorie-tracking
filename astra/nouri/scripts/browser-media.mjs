import { prepareCamera, cleanupCamera } from "./prepare-camera.mjs";
const cameraPath = await prepareCamera();
import { chromium, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import sharp from "sharp";
const browser = await chromium.launch({
  headless: true,
  args: [
    "--use-fake-device-for-media-stream",
    "--use-fake-ui-for-media-stream",
    `--use-file-for-fake-video-capture=${cameraPath}`,
  ],
});
const context = await browser.newContext({
    storageState: "test-results/browser-state.json",
    viewport: { width: 390, height: 844 },
    permissions: ["camera"],
  }),
  page = await context.newPage();
const errors = [],
  calls = [],
  images = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
page.on("request", (r) => {
  if (r.url().endsWith("/api/january")) {
    const p = r.postDataJSON();
    calls.push({ method: p.method, path: p.path });
    if (p.body?.image?.startsWith("data:")) images.push(p.body.image);
  }
});
const journal = () =>
  page.evaluate(() =>
    JSON.parse(localStorage.getItem("nouri-journal") || "{}"),
  );
async function waitMeal(count) {
  await page.waitForFunction(
    (n) => {
      const j = JSON.parse(localStorage.getItem("nouri-journal") || "{}");
      return (
        j.meals.length === n && j.meals.every((m) => m.status !== "analyzing")
      );
    },
    count,
    { timeout: 120000 },
  );
  const m = (await journal()).meals.at(-1);
  console.log("MEDIA MEAL", {
    name: m.name,
    status: m.status,
    calories: m.nutrients.calories?.value,
    error: m.error,
    warning: m.warning,
  });
  if (m.status !== "ready" || m.warning)
    throw Error("Media analysis failed reconciliation");
  return m;
}
try {
  await page.goto("http://localhost:8085", { waitUntil: "networkidle" });
  let count = (await journal()).meals.length;
  await page
    .getByRole("button", { name: "Quick add meal", exact: true })
    .click();
  await page.getByRole("button", { name: "Label mode", exact: true }).click();
  const chooser = page.waitForEvent("filechooser");
  await page
    .getByRole("button", { name: "Upload nutrition label", exact: true })
    .click();
  await (await chooser).setFiles("tests/fixtures/nutrition-label.png");
  await waitMeal(++count);
  await page
    .getByRole("button", { name: "Quick add meal", exact: true })
    .click();
  await page.getByRole("button", { name: "Open camera", exact: true }).click();
  const allow = page.getByRole("button", { name: "Allow camera", exact: true });
  if (await allow.count()) await allow.click();
  await expect(
    page.getByRole("button", { name: "Take photo", exact: true }),
  ).toBeEnabled({ timeout: 15000 });
  await page.screenshot({ path: "test-results/camera.png" });
  await page.getByRole("button", { name: "Take photo", exact: true }).click();
  await waitMeal(++count);
  await page.screenshot({ path: "test-results/mobile-home.png" });
  await page.getByRole("button", { name: "Progress", exact: true }).click();
  await page.screenshot({ path: "test-results/mobile-progress.png" });
  await page.getByRole("button", { name: "You", exact: true }).click();
  await page.getByRole("button", { name: "Start over", exact: true }).click();
  await expect(
    page.getByRole("button", {
      name: "Reset profile and start over",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Keep my settings", exact: true })
    .click();
  const before = await journal();
  await page.reload({ waitUntil: "networkidle" });
  if ((await journal()).meals.length !== before.meals.length)
    throw Error("Journal did not persist");
  if (
    await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    )
  )
    throw Error("Mobile horizontal overflow");
  for (const image of images) {
    const meta = await sharp(
      Buffer.from(image.split(",")[1], "base64"),
    ).metadata();
    console.log("PREPARED IMAGE", {
      width: meta.width,
      height: meta.height,
      format: meta.format,
      bytes: image.length,
    });
  }
  if (errors.length) throw Error("Console errors remain");
  console.log("MEDIA PASSED");
} catch (e) {
  console.log("FAILED", e.message);
  console.log("BODY", await page.locator("body").innerText());
  process.exitCode = 1;
} finally {
  await context.storageState({ path: "test-results/browser-state.json" });
  await page.screenshot({ path: "test-results/media-latest.png" });
  await writeFile(
    "test-results/browser-journal.json",
    JSON.stringify(await journal(), null, 2),
  );
  await writeFile("test-results/media-errors.json", JSON.stringify(errors));
  await writeFile("test-results/media-calls.json", JSON.stringify(calls));
  console.log("ERRORS", errors);
  console.log("PAID CALLS", calls.filter((c) => c.path !== "/credits").length);
  await browser.close();
  await cleanupCamera();
}
