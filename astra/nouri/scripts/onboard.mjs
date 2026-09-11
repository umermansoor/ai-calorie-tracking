export async function finishOnboarding(page) {
  await page.getByRole("button", { name: "Start", exact: true }).click();
  // Seven focused questions for the default maintenance goal, then the targets.
  for (let step = 0; step < 7; step++)
    await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page
    .getByRole("button", { name: "Start tracking", exact: true })
    .click();
}
