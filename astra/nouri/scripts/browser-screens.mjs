import { chromium, expect } from "@playwright/test";
import { mkdir, writeFile, readFile } from "node:fs/promises";
const origin = process.env.NOURI_TEST_ORIGIN || "http://localhost:8085";
const storageState = JSON.parse(
  await readFile("test-results/browser-state.json", "utf8"),
);
storageState.origins.forEach((entry) => {
  entry.origin = origin;
});
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  storageState,
  viewport: { width: 390, height: 844 },
});
const page = await context.newPage(),
  errors = [],
  blocked = [];
await context.route("**/api/january", (route) => {
  blocked.push(route.request().postDataJSON().path);
  return route.abort();
});
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
const folder = "docs/screenshots/review";
await mkdir(folder, { recursive: true });
async function shot(name, locator) {
  if (locator) await locator.scrollIntoViewIfNeeded();
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${folder}/${name}.png` });
  const overflow = await page.evaluate(() =>
    [...document.querySelectorAll('button,[role="button"],input,textarea')]
      .filter((e) => {
        const r = e.getBoundingClientRect();
        return (
          r.width > 0 &&
          r.height > 0 &&
          (r.left < -1 || r.right > innerWidth + 1)
        );
      })
      .map((e) => e.getAttribute("aria-label") || e.textContent),
  );
  if (overflow.length) throw Error(`${name}: overflow ${overflow.join(", ")}`);
}
try {
  await page.goto(origin, { waitUntil: "networkidle" });
  await expect(page.getByTestId("calories-left")).toBeVisible();
  const meals = await page.evaluate(
    () => JSON.parse(localStorage.getItem("nouri-journal")).meals,
  );
  await shot("home");
  await shot(
    "meals",
    page.getByRole("button", { name: "Add a meal", exact: true }),
  );
  await page.getByRole("button", { name: "Progress", exact: true }).click();
  await shot("progress");
  await shot(
    "weight",
    page.getByRole("textbox", { name: "Today’s weight · kg", exact: true }),
  );
  await page.getByRole("button", { name: "You", exact: true }).click();
  await shot("settings");
  if (
    await page
      .getByRole("button", { name: "Edit profile", exact: true })
      .count()
  )
    await page
      .getByRole("button", { name: "Edit profile", exact: true })
      .click();
  await shot(
    "profile",
    page.getByRole("textbox", { name: "Age", exact: true }),
  );
  if (
    await page
      .getByRole("button", { name: "Adjust targets", exact: true })
      .count()
  )
    await page
      .getByRole("button", { name: "Adjust targets", exact: true })
      .click();
  await shot(
    "targets",
    page.getByRole("textbox", { name: "Calories", exact: true }),
  );
  await page.getByRole("button", { name: "Start over", exact: true }).click();
  await shot(
    "reset",
    page.getByRole("button", {
      name: "Reset profile and start over",
      exact: true,
    }),
  );
  await page
    .getByRole("button", { name: "Keep my settings", exact: true })
    .click();
  for (const m of meals.filter(
    (m) =>
      m.source === "Photo" ||
      m.source === "Barcode" ||
      m.source === "Description",
  )) {
    await page.goto(`${origin}/meal/${m.localId}`, {
      waitUntil: "networkidle",
    });
    await shot(`meal-${m.source.toLowerCase()}`);
    await shot(
      `ingredients-${m.source.toLowerCase()}`,
      page.getByText("What’s inside", { exact: true }),
    );
    await shot(
      "correction",
      page.getByRole("textbox", { name: "Fix results", exact: true }),
    );
    await shot(
      "glucose",
      page.getByText("Blood sugar impact", { exact: true }),
    );
    await page.getByRole("button", { name: "Edit meal", exact: true }).click();
    await shot(
      "edit",
      page.getByRole("textbox", { name: "Meal name", exact: true }),
    );
    await page
      .getByRole("button", { name: "Cancel edit", exact: true })
      .click();
  }
  await page.goto(`${origin}/add`, { waitUntil: "networkidle" });
  await shot("photo");
  await page.getByRole("button", { name: "Open camera", exact: true }).click();
  await shot("camera-permission");
  await page.getByRole("button", { name: "Close camera", exact: true }).click();
  for (const mode of ["Describe", "Barcode", "Label", "Search"]) {
    await page
      .getByRole("button", { name: `${mode} mode`, exact: true })
      .click();
    await shot(`add-${mode.toLowerCase()}`);
  }
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto(`${origin}/progress`, { waitUntil: "networkidle" });
  await shot("progress-small");
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto(`${origin}/progress`, { waitUntil: "networkidle" });
  await shot("progress-desktop");
  if (blocked.length)
    throw Error(`Unexpected API requests: ${blocked.join(", ")}`);
  if (errors.length) throw Error(errors.join("\n"));
  console.log("ALL SCREEN CAPTURES PASSED; zero API calls or console errors");
} finally {
  await writeFile("test-results/screens-errors.json", JSON.stringify(errors));
  await browser.close();
}
