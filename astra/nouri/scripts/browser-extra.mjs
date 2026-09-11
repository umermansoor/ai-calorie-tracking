import { chromium, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
    storageState: "test-results/browser-state.json",
    viewport: { width: 1440, height: 1100 },
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
    calls.push({ method: p.method, path: p.path, etag: !!p.etag });
  }
});
const journal = () =>
  page.evaluate(() =>
    JSON.parse(localStorage.getItem("nouri-journal") || "{}"),
  );
async function updated(id, predicate) {
  await page.waitForFunction(
    ({ id, predicate }) => {
      const j = JSON.parse(localStorage.getItem("nouri-journal") || "{}");
      const m = j.meals.find((m) => m.localId === id);
      return Function("m", `return ${predicate}`)(m);
    },
    { id, predicate },
    { timeout: 100000 },
  );
}
try {
  await page.goto("http://localhost:8085", { waitUntil: "networkidle" });
  let j = await journal();
  const typed = j.meals.find((m) => m.source === "Description"),
    banana = j.meals.find((m) => m.source === "Search"),
    salad = j.meals.find((m) => m.source === "Photo");
  await page
    .getByRole("button", { name: `Open ${typed.name}`, exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Fix results", exact: true })
    .fill("There was only 20 g of feta cheese and 100 g of cucumber.");
  await page
    .getByRole("button", { name: "Apply correction", exact: true })
    .click();
  await updated(typed.localId, "m.nutrients.calories.value < 90");
  console.log(
    "CORRECTION",
    (await journal()).meals.find((m) => m.localId === typed.localId).nutrients
      .calories.value,
  );
  await page
    .getByRole("button", { name: "Predict glucose curve", exact: true })
    .click();
  await updated(typed.localId, "m.prediction?.points?.length > 0");
  console.log(
    "GLUCOSE",
    (await journal()).meals.find((m) => m.localId === typed.localId).prediction,
  );
  await page.screenshot({ path: "test-results/glucose.png" });
  await page
    .getByRole("button", { name: "Find healthier swaps", exact: true })
    .click();
  await expect(
    page
      .getByText(
        "No alternatives match this ingredient and your diet. Try another ingredient.",
      )
      .or(page.getByRole("button", { name: /^Use / }).first()),
  ).toBeVisible({ timeout: 60000 });
  console.log(
    "SWAPS",
    await page.getByRole("button", { name: /^Use / }).count(),
  );
  await page.getByRole("button", { name: "Go back", exact: true }).click();
  await page
    .getByRole("button", { name: `Open ${banana.name}`, exact: true })
    .click();
  await page.getByRole("button", { name: "Edit meal", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Meal name", exact: true })
    .fill("Two bananas");
  await page
    .getByRole("textbox", { name: /^Servings of / })
    .first()
    .fill("2");
  await page.getByRole("button", { name: /^Save meal ·/ }).click();
  await updated(banana.localId, 'm.name === "Two bananas"');
  console.log(
    "EDIT",
    (await journal()).meals.find((m) => m.localId === banana.localId).nutrients
      .calories.value,
  );
  await page.getByRole("button", { name: "Go back", exact: true }).click();
  await page.getByRole("button", { name: "Add a meal", exact: true }).click();
  await page
    .getByRole("button", { name: "Analyze Sunday pancakes", exact: true })
    .click();
  await page.waitForFunction(
    () => {
      const j = JSON.parse(localStorage.getItem("nouri-journal") || "{}");
      return (
        j.meals.length === 5 && j.meals.every((m) => m.status !== "analyzing")
      );
    },
    null,
    { timeout: 120000 },
  );
  const pancake = (await journal()).meals.at(-1);
  console.log(
    "PANCAKE",
    pancake.status,
    pancake.name,
    pancake.nutrients.calories?.value,
    pancake.error,
    pancake.warning,
  );
  if (pancake.status !== "ready" || pancake.warning)
    throw Error("Pancake analysis not reconciled");
  await page
    .getByRole("button", { name: `Open ${pancake.name}`, exact: true })
    .click();
  const pancakeScore = Number(
    (await page.getByTestId("health-score").innerText()).split("/")[0],
  );
  await page.getByRole("button", { name: "Go back", exact: true }).click();
  await page
    .getByRole("button", { name: `Open ${salad.name}`, exact: true })
    .click();
  const saladScore = Number(
    (await page.getByTestId("health-score").innerText()).split("/")[0],
  );
  if (pancakeScore >= saladScore)
    throw Error(`Score regression: ${pancakeScore} vs ${saladScore}`);
  console.log("SCORES", { pancakeScore, saladScore });
  await page.getByRole("button", { name: "Go back", exact: true }).click();
  await page.getByRole("button", { name: "Progress", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Today’s weight · kg", exact: true })
    .fill("69.8");
  await page
    .getByRole("button", { name: "Record weight", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Weight saved", exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: "test-results/progress.png" });
  await page.getByRole("button", { name: "You", exact: true }).click();
  await page
    .getByRole("button", { name: "Check remaining credits", exact: true })
    .click();
  await expect(page.getByText(/credits left/)).toBeVisible({ timeout: 15000 });
  await page.getByRole("button", { name: "Today", exact: true }).click();
  await page
    .getByRole("button", { name: "Open Two bananas", exact: true })
    .click();
  await page.getByRole("button", { name: "Delete meal", exact: true }).click();
  await page
    .getByRole("button", { name: "Yes, delete meal", exact: true })
    .click();
  await page.waitForFunction(
    (id) =>
      !JSON.parse(localStorage.getItem("nouri-journal")).meals.some(
        (m) => m.localId === id,
      ),
    banana.localId,
    { timeout: 30000 },
  );
  await page
    .getByRole("button", { name: "Refresh diary", exact: true })
    .click();
  await page.getByRole("button", { name: "Add a meal", exact: true }).click();
  await page.getByRole("button", { name: "Open camera", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Allow camera", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close camera", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Upload photo", exact: true }),
  ).toBeVisible();
  console.log("EXTRA PASSED");
} catch (e) {
  console.log("FAILED", e.message);
  console.log("BODY", await page.locator("body").innerText());
  process.exitCode = 1;
} finally {
  await context.storageState({ path: "test-results/browser-state.json" });
  await page.screenshot({ path: "test-results/extra-latest.png" });
  await writeFile(
    "test-results/browser-journal.json",
    JSON.stringify(await journal(), null, 2),
  );
  await writeFile("test-results/extra-errors.json", JSON.stringify(errors));
  await writeFile("test-results/extra-calls.json", JSON.stringify(calls));
  console.log("ERRORS", errors);
  console.log("PAID CALLS", calls.filter((c) => c.path !== "/credits").length);
  await browser.close();
}
