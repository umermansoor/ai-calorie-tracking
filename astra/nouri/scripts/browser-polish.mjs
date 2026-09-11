import { chromium, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
await mkdir("test-results", { recursive: true });
await mkdir("docs/screenshots", { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  }),
  page = await context.newPage();
const errors = [],
  calls = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
page.on("request", (r) => {
  if (r.url().endsWith("/api/january")) calls.push(r.postDataJSON());
});
const journal = () =>
  page.evaluate(() =>
    JSON.parse(localStorage.getItem("nouri-journal") || "{}"),
  );
try {
  await page.goto("http://localhost:8085", { waitUntil: "networkidle" });
  await expect(
    page.getByRole("button", { name: "Start", exact: true }),
  ).toBeInViewport();
  await page.screenshot({ path: "docs/screenshots/welcome-glass.png" });
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await expect(page.getByRole("textbox")).toHaveCount(0);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByRole("textbox")).toHaveCount(1);
  await page.getByRole("textbox", { name: "Age", exact: true }).fill("15");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByText("Enter 18–100 years to continue.")).toBeVisible();
  await page.getByRole("textbox", { name: "Age", exact: true }).fill("32");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page
    .getByRole("button", { name: "Previous step", exact: true })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Age", exact: true }),
  ).toHaveValue("32");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Lose weight", exact: true }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByText("Pick your pace.")).toBeVisible();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(
    page.getByText("Your starting point.", { exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: "docs/screenshots/targets-glass.png" });
  await page
    .getByRole("button", { name: "Start tracking", exact: true })
    .click();
  const today = await page.evaluate(() =>
    new Date().toLocaleDateString("en-CA"),
  );
  await expect(page.getByTestId(`day-ring-${today}`)).toBeVisible();
  const add = page.getByRole("button", { name: "Add water", exact: true });
  await add.click();
  await add.click();
  await add.click();
  await expect(page.getByTestId("water-total")).toHaveText("24 fl oz (3 cups)");
  await page.getByRole("button", { name: "Remove water", exact: true }).click();
  await expect(page.getByTestId("water-total")).toHaveText("16 fl oz (2 cups)");
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.getByTestId("water-total")).toHaveText("16 fl oz (2 cups)");
  await page
    .getByRole("button", { name: "Water settings", exact: true })
    .click();
  await page.getByRole("button", { name: "ml", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Cup size · ml", exact: true })
    .fill("250");
  await page
    .getByRole("textbox", { name: "Daily water goal · ml", exact: true })
    .fill("2000");
  await page
    .getByRole("button", { name: "Save water settings", exact: true })
    .click();
  await add.click();
  await expect(page.getByTestId("water-total")).toHaveText(
    "723.2 ml (2.9 cups)",
  );
  const past = page.getByRole("button", { name: /^Select / }).first();
  await past.click();
  await expect(page.getByTestId("water-total")).toHaveText("0 ml (0 cups)");
  await add.click();
  await page
    .getByRole("button", { name: `Select ${today}`, exact: true })
    .click();
  await expect(page.getByTestId("water-total")).toHaveText(
    "723.2 ml (2.9 cups)",
  );
  if (calls.length)
    throw Error("Local onboarding/water unexpectedly made API calls");
  console.log("ONBOARDING + LOCAL WATER PASSED; no API calls");
  await page
    .getByRole("button", { name: "Quick add meal", exact: true })
    .click();
  await page.getByRole("button", { name: "Search mode", exact: true }).click();
  const field = page.getByRole("textbox", {
    name: "Search foods",
    exact: true,
  });
  await field.fill("b");
  await page.waitForTimeout(750);
  if (calls.length) throw Error("A one-character query consumed a credit");
  await field.fill("ban");
  const choose = page.getByRole("button", { name: /^Choose / }).first();
  await expect(choose).toBeVisible({ timeout: 20000 });
  if (calls.filter((c) => c.path === "/foods/autocomplete").length !== 1)
    throw Error("Unexpected typeahead request count");
  await page.screenshot({ path: "docs/screenshots/autocomplete.png" });
  await field.fill("");
  await field.fill("ban");
  await expect(choose).toBeVisible();
  if (calls.filter((c) => c.path === "/foods/autocomplete").length !== 1)
    throw Error("Repeat query did not use cache");
  await choose.click();
  await page
    .getByRole("button", { name: "Log this food", exact: true })
    .click();
  await page.waitForFunction(
    () =>
      JSON.parse(localStorage.getItem("nouri-journal")).meals.some(
        (m) => m.status === "ready",
      ),
    null,
    { timeout: 30000 },
  );
  const meal = (await journal()).meals.at(-1);
  if (meal.nutrients.calories.value < 20 || meal.nutrients.calories.value > 800)
    throw Error("Implausible autocomplete serving");
  const offset = await page
    .getByTestId(`day-ring-${today}`)
    .locator("circle")
    .nth(1)
    .getAttribute("stroke-dashoffset");
  if (Number(offset) >= 104) throw Error("Calendar progress did not update");
  await page.screenshot({ path: "docs/screenshots/home-glass-mobile.png" });
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.evaluate(() => document.activeElement?.blur());
  await page.waitForFunction(() =>
    Array.from(document.images).every((i) => i.complete),
  );
  await page.screenshot({ path: "docs/screenshots/home-glass-desktop.png" });
  console.log(
    "AUTOCOMPLETE LOGGED",
    meal.name,
    meal.nutrients.calories.value,
    "kcal",
  );
  await page
    .getByRole("button", { name: `Open ${meal.name}`, exact: true })
    .click();
  await page.getByRole("button", { name: "Delete meal", exact: true }).click();
  await page
    .getByRole("button", { name: "Yes, delete meal", exact: true })
    .click();
  await page.waitForFunction(
    () => JSON.parse(localStorage.getItem("nouri-journal")).meals.length === 0,
    null,
    { timeout: 20000 },
  );
  await page.setViewportSize({ width: 360, height: 740 });
  await page.reload({ waitUntil: "networkidle" });
  if (
    await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
  )
    throw Error("Small mobile horizontal overflow");
  if (errors.length) throw Error("Browser errors");
  console.log(
    "POLISH PASSED",
    calls.filter((c) => c.path != "/credits").length,
    "paid calls",
  );
} catch (e) {
  console.log("FAILED", e.message);
  console.log(await page.locator("body").innerText());
  process.exitCode = 1;
} finally {
  await page.screenshot({ path: "test-results/polish-latest.png" });
  await writeFile("test-results/polish-errors.json", JSON.stringify(errors));
  await writeFile(
    "test-results/polish-calls.json",
    JSON.stringify(calls.map(({ method, path }) => ({ method, path }))),
  );
  console.log("ERRORS", errors);
  await browser.close();
}
