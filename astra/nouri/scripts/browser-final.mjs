import { finishOnboarding } from "./onboard.mjs";
import { prepareCamera, cleanupCamera } from "./prepare-camera.mjs";
const cameraPath = await prepareCamera();
import { chromium, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
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
  calls = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
page.on("request", (r) => {
  if (r.url().endsWith("/api/january")) {
    const p = r.postDataJSON();
    calls.push({ method: p.method, path: p.path });
  }
});
const journal = () =>
  page.evaluate(() =>
    JSON.parse(localStorage.getItem("nouri-journal") || "{}"),
  );
try {
  await page.goto("http://localhost:8085", { waitUntil: "networkidle" });
  const initial = await journal(),
    count = initial.meals.length;
  await page
    .getByRole("button", { name: "Quick add meal", exact: true })
    .click();
  await page.getByRole("button", { name: "Open camera", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Take photo", exact: true }),
  ).toBeEnabled({ timeout: 15000 });
  await page.screenshot({ path: "test-results/camera.png" });
  await page.getByRole("button", { name: "Take photo", exact: true }).click();
  await expect(
    page.getByText("Analyzing…", { exact: true }).first(),
  ).toBeInViewport();
  await page.waitForFunction(
    (n) => {
      const j = JSON.parse(localStorage.getItem("nouri-journal") || "{}");
      return (
        j.meals.length === n && j.meals.every((m) => m.status !== "analyzing")
      );
    },
    count + 1,
    { timeout: 100000 },
  );
  const m = (await journal()).meals.at(-1);
  if (m.status !== "ready" || m.warning)
    throw Error("Camera meal not verified");
  console.log("CAMERA", { name: m.name, calories: m.nutrients.calories.value });
  await page.getByTestId(`meal-${m.localId}`).click();
  await page.getByRole("button", { name: "Delete meal", exact: true }).click();
  await page
    .getByRole("button", { name: "Yes, delete meal", exact: true })
    .click();
  await page.waitForFunction(
    (id) =>
      !JSON.parse(localStorage.getItem("nouri-journal")).meals.some(
        (m) => m.localId === id,
      ),
    m.localId,
    { timeout: 30000 },
  );
  const cola = (await journal()).meals.find((m) => m.source === "Barcode");
  await page
    .getByRole("button", { name: `Open ${cola.name}`, exact: true })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Fix results", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Find healthier swaps", exact: true })
    .click();
  const use = page.getByRole("button", { name: /^Use / }).first();
  await use.waitFor({ timeout: 30000 });
  await use.click();
  await page
    .getByRole("textbox", { name: "Meal name", exact: true })
    .fill("A lighter drink");
  await page.getByRole("button", { name: /^Save meal ·/ }).click();
  await page.waitForFunction(
    (id) =>
      JSON.parse(localStorage.getItem("nouri-journal")).meals.find(
        (m) => m.localId === id,
      )?.name === "A lighter drink",
    cola.localId,
    { timeout: 30000 },
  );
  console.log("SWAP SAVED");
  await page.getByRole("button", { name: "Go back", exact: true }).click();
  await page.screenshot({ path: "test-results/mobile-home.png" });
  await page.getByRole("button", { name: "Progress", exact: true }).click();
  await page.screenshot({ path: "test-results/mobile-progress.png" });
  await page.getByRole("button", { name: "You", exact: true }).click();
  await page.getByRole("button", { name: "Start over", exact: true }).click();
  await page
    .getByRole("button", { name: "Reset profile and start over", exact: true })
    .click();
  await finishOnboarding(page);
  if ((await journal()).meals.length !== count)
    throw Error("Start over unexpectedly lost meals");
  const device = await page.evaluate(() =>
    localStorage.getItem("nouri-device"),
  );
  await page.reload({ waitUntil: "networkidle" });
  if ((await journal()).meals.length !== count)
    throw Error("Persistence failed");
  if (
    (await page.evaluate(() => localStorage.getItem("nouri-device"))) !== device
  )
    throw Error("Device identity changed");
  if (
    await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    )
  )
    throw Error("Mobile overflow");
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.screenshot({ path: "test-results/final-desktop.png" });
  if (errors.length) throw Error("Unexpected console errors");
  console.log("FINAL UI PASSED");
} catch (e) {
  console.log("FAILED", e.message);
  console.log("BODY", await page.locator("body").innerText());
  process.exitCode = 1;
} finally {
  await context.storageState({ path: "test-results/browser-state.json" });
  await writeFile(
    "test-results/browser-journal.json",
    JSON.stringify(await journal(), null, 2),
  );
  await writeFile("test-results/final-errors.json", JSON.stringify(errors));
  await writeFile("test-results/final-calls.json", JSON.stringify(calls));
  await page.screenshot({ path: "test-results/final-latest.png" });
  console.log("ERRORS", errors);
  console.log("PAID CALLS", calls.filter((c) => c.path !== "/credits").length);
  await browser.close();
  await cleanupCamera();
}
