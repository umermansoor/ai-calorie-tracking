import { chromium, expect } from "@playwright/test";
import { mkdir, readFile } from "node:fs/promises";
const browser = await chromium.launch({ headless: true });
const origin = process.env.NOURI_TEST_ORIGIN || "http://localhost:8085";
const folder = "docs/screenshots/review";
await mkdir(folder, { recursive: true });
const errors = [],
  calls = [];
async function setup(options = {}) {
  if (typeof options.storageState === "string") {
    const state = JSON.parse(await readFile(options.storageState, "utf8"));
    state.origins.forEach((entry) => {
      entry.origin = origin;
    });
    options = { ...options, storageState: state };
  }
  const context = await browser.newContext({
    viewport: { width: 360, height: 740 },
    ...options,
  });
  await context.route("**/api/january", (route) => {
    calls.push(route.request().postDataJSON().path);
    return route.abort();
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  return { context, page };
}
const button = (page, name) => page.getByRole("button", { name, exact: true });
const field = (page, name) => page.getByRole("textbox", { name, exact: true });
async function screenshot(page, name) {
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${folder}/${name}.png` });
}
try {
  const { page, context } = await setup();
  await page.goto(origin, { waitUntil: "networkidle" });
  await expect(button(page, "Start")).toBeInViewport();
  await screenshot(page, "onboarding-welcome");
  await button(page, "Start").click();
  for (const step of [
    "sex",
    "age",
    "height",
    "weight",
    "goal",
    "pace",
    "activity",
    "diet",
    "review",
  ]) {
    if (step === "age") {
      await field(page, "Age").fill("15");
      await button(page, "Continue").click();
      await expect(page.getByRole("alert")).toContainText("18–100");
      await field(page, "Age").fill("30");
    }
    if (step === "goal") await button(page, "Lose weight").click();
    await screenshot(page, `onboarding-${step}`);
    const cta = button(page, step === "review" ? "Start tracking" : "Continue");
    await expect(cta).toBeInViewport();
    await cta.click();
  }
  await expect(page.getByTestId("calories-left")).toBeVisible();
  await button(page, "Add water").click();
  await button(page, "Add water").click();
  await button(page, "Add water").click();
  await expect(page.getByTestId("water-total")).toHaveText("24 fl oz (3 cups)");
  await button(page, "Water settings").click();
  await field(page, "Cup size · fl oz").fill("0");
  await button(page, "Save water settings").click();
  await expect(page.getByRole("alert")).toBeVisible();
  await field(page, "Cup size · fl oz").fill("8");
  await button(page, "Save water settings").click();
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.getByTestId("water-total")).toHaveText("24 fl oz (3 cups)");
  await button(page, "Progress").click();
  await expect(
    page.getByText("Ready for day one.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Log a meal to see your daily average.", { exact: true }),
  ).toBeVisible();
  await screenshot(page, "progress-empty");
  await button(page, "You").click();
  await expect(button(page, "Edit profile")).toBeVisible();
  await expect(field(page, "Age")).toHaveCount(0);
  await button(page, "Edit profile").click();
  await field(page, "Weight · kg").fill("69");
  await field(page, "Weight · kg").pressSequentially(".5", { delay: 80 });
  await expect(field(page, "Weight · kg")).toHaveValue("69.5");
  await button(page, "Close profile").click();
  await expect(button(page, "Save profile & targets")).toBeVisible();
  await button(page, "Cancel changes").click();
  await button(page, "Edit profile").click();
  await expect(field(page, "Weight · kg")).toHaveValue("70");
  await button(page, "Recalculate my targets").click();
  await field(page, "Calories").fill("999");
  await button(page, "Save profile & targets").click();
  await expect(
    page.getByRole("alert").filter({ hasText: "1,000–6,000" }),
  ).toBeVisible();
  await field(page, "Calories").fill("2000");
  await field(page, "Weight · kg").fill("69.5");
  await button(page, "Save profile & targets").click();
  await expect(
    page.getByText("Your profile and targets are saved.", { exact: true }),
  ).toBeVisible();
  await page.reload({ waitUntil: "networkidle" });
  await button(page, "Edit profile").click();
  await expect(field(page, "Weight · kg")).toHaveValue("69.5");
  await button(page, "Close profile").click();
  await expect(page.getByText("2,000", { exact: true })).toBeVisible();
  await button(page, "Start over").click();
  await button(page, "Keep my settings").click();
  await context.close();
  const populated = await setup({
    storageState: "test-results/browser-state.json",
  });
  await populated.page.goto(`${origin}/progress`, { waitUntil: "networkidle" });
  await expect(
    populated.page.getByText("day in a row", { exact: true }),
  ).toBeVisible();
  await expect(
    populated.page.getByText("Daily average · 1 logged day", { exact: true }),
  ).toBeVisible();
  await expect(populated.page.getByText(/\bavg\b/)).toHaveCount(0);
  const j = await populated.page.evaluate(() =>
    JSON.parse(localStorage.getItem("nouri-journal")),
  );
  const cola = j.meals.find((m) => m.source === "Barcode");
  await populated.page.goto(`${origin}/meal/${cola.localId}`, {
    waitUntil: "networkidle",
  });
  await button(populated.page, "Edit meal").click();
  const serving = populated.page
    .getByRole("textbox", { name: /^Servings of / })
    .first();
  await serving.fill("");
  await serving.pressSequentially(".5", { delay: 80 });
  await expect(serving).toHaveValue(".5");
  await button(populated.page, "Cancel edit").click();
  if (errors.length || calls.length)
    throw Error(JSON.stringify({ errors, calls }));
  console.log(
    "LOCAL REVIEW PASSED: every onboarding step, empty/populated progress, water, profile/target save/cancel/validation, decimal servings; zero API calls or console errors",
  );
} finally {
  await browser.close();
}
