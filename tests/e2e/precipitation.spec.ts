import { expect, test } from "@playwright/test";

test("registered precipitation lab mixes solutions and evaluates conclusions", async ({
  page
}) => {
  const browserErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  page.on("pageerror", (error) => browserErrors.push(error.message));

  await page.goto("/lab/precipitation");
  await page.getByLabel("Solution A").selectOption("silver_nitrate");
  await page.getByLabel("Solution B").selectOption("sodium_chloride");
  await page.getByRole("button", { name: "Mix solutions" }).click();

  await expect(
    page.getByRole("status").filter({ hasText: "white solid" })
  ).toBeVisible();
  await page
    .getByLabel("Predicted precipitate")
    .selectOption("silver_chloride");
  await page.getByRole("button", { name: "Check prediction" }).click();
  await expect(
    page.getByText("Prediction supported by the engine evidence.")
  ).toBeVisible();

  await page
    .getByLabel("Net ionic equation")
    .fill("Ag+(aq) + Cl-(aq) → AgCl(s)");
  await page.getByRole("button", { name: "Check equation" }).click();
  await expect(
    page.getByText("Equation supported by the engine evidence.")
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Report" })).toHaveCount(0);
  expect(browserErrors).toEqual([]);
});
