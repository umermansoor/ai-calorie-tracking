import { finishOnboarding } from "./onboard.mjs";
import { chromium, expect } from "@playwright/test";
import { mkdir, writeFile, readFile } from "node:fs/promises";
const origin = process.env.NOURI_TEST_ORIGIN || "http://localhost:8085";
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1100 },
});
const page = await context.newPage(),
  errors = [],
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
await mkdir("test-results", { recursive: true });
const journal = () =>
  page.evaluate(() =>
    JSON.parse(localStorage.getItem("nouri-journal") || "{}"),
  );
async function waitForMeal(count) {
  await page.waitForFunction(
    (n) => {
      const j = JSON.parse(localStorage.getItem("nouri-journal") || "{}");
      return (
        j.meals?.length === n && j.meals.every((m) => m.status !== "analyzing")
      );
    },
    count,
    { timeout: 120000 },
  );
  const j = await journal();
  const meal = j.meals.at(-1);
  console.log(
    "MEAL",
    JSON.stringify({
      name: meal.name,
      status: meal.status,
      calories: meal.nutrients.calories?.value,
      error: meal.error,
      warning: meal.warning,
    }),
  );
  if (meal.status !== "ready" || meal.warning)
    throw Error("Meal did not reconcile: " + JSON.stringify(meal));
  return meal;
}
try {
  await page.goto(origin, { waitUntil: "networkidle" });
  await finishOnboarding(page);
  await expect(page.getByTestId("calories-left")).toBeVisible();
  await page.screenshot({ path: "test-results/home-empty.png" });
  await page.getByRole("button", { name: "Add a meal", exact: true }).click();
  await page
    .getByRole("button", { name: "Analyze Garden bowl", exact: true })
    .click();
  await expect(
    page.getByText("Analyzing…", { exact: true }).first(),
  ).toBeVisible();
  const photo = await waitForMeal(1);
  if (
    photo.nutrients.calories.value < 100 ||
    photo.nutrients.calories.value > 1500
  )
    throw Error("Implausible salad");
  await page
    .getByRole("button", { name: `Open ${photo.name}`, exact: true })
    .click();
  await page.screenshot({ path: "test-results/meal-photo.png" });
  console.log(
    "PHOTO SCORE",
    await page.getByTestId("health-score").innerText(),
  );
  await page.getByRole("button", { name: "Go back", exact: true }).click();
  await page.getByRole("button", { name: "Add a meal", exact: true }).click();
  await page
    .getByRole("button", { name: "Describe mode", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Describe your meal", exact: true })
    .fill("40 g feta cheese and 100 g cucumber");
  await page
    .getByRole("button", { name: "Analyze description", exact: true })
    .click();
  const typed = await waitForMeal(2);
  if (
    typed.nutrients.calories.value < 110 ||
    typed.nutrients.calories.value > 135
  )
    throw Error("Feta portion regression");
  await page.getByRole("button", { name: "Add a meal", exact: true }).click();
  await page.getByRole("button", { name: "Barcode mode", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Barcode number", exact: true })
    .fill("049000006346");
  await page
    .getByRole("button", { name: "Look up barcode", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Log this food", exact: true })
    .click({ timeout: 30000 });
  await waitForMeal(3);
  await page.getByRole("button", { name: "Add a meal", exact: true }).click();
  await page.getByRole("button", { name: "Search mode", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Search foods", exact: true })
    .fill("banana");
  await page
    .getByRole("button", { name: /^Choose / })
    .first()
    .click({ timeout: 30000 });
  await page
    .getByRole("button", { name: "Log this food", exact: true })
    .click({ timeout: 30000 });
  await waitForMeal(4);
  await page.screenshot({ path: "test-results/home-populated.png" });
  console.log("CORE PASSED");
} catch (e) {
  console.log("FAILED", e.message);
  console.log("BODY", await page.locator("body").innerText());
  process.exitCode = 1;
} finally {
  await context.storageState({ path: "test-results/browser-state.json" });
  await page.screenshot({ path: "test-results/latest.png", fullPage: true });
  await writeFile(
    "test-results/browser-journal.json",
    JSON.stringify(await journal(), null, 2),
  );
  await writeFile(
    "test-results/browser-errors.json",
    JSON.stringify(errors, null, 2),
  );
  await writeFile(
    "test-results/browser-calls.json",
    JSON.stringify(calls, null, 2),
  );
  console.log("ERRORS", errors);
  console.log("PAID CALLS", calls.filter((c) => c.path !== "/credits").length);
  await browser.close();
}
