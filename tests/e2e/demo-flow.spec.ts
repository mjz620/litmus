import { expect, test } from "@playwright/test";

import { openLabCoach, openPrecisionControls } from "./labHelpers";

test("demo carries real endpoint evidence through student, teacher, technical, and reset", async ({
  page
}) => {
  const browserErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  page.on("pageerror", (error) => browserErrors.push(error.message));

  await page.goto("/demo/student");
  await expect(page.getByText("3D bench ready", { exact: true })).toBeVisible({
    timeout: 30_000
  });
  await openPrecisionControls(page);
  await expect(
    page.getByText("22.00 mL cumulative", { exact: true })
  ).toBeVisible();
  await page.getByLabel("Volume to add (mL)").fill("4");
  await page.getByLabel("Delivery time (seconds)").fill("1");
  await page.getByRole("button", { name: "Add titrant", exact: true }).click();
  await page.getByRole("button", { name: "Close precision controls" }).click();
  await openLabCoach(page);
  await expect(
    page.getByText(/endpoint evidence shows the addition went past/i)
  ).toBeVisible();

  await page.goto("/demo/teacher");
  await expect(
    page.getByText("Your demo session", { exact: true })
  ).toBeVisible();

  await page.goto("/demo/technical");
  await expect(
    page.getByRole("heading", { name: "Live technical trace" })
  ).toBeVisible();
  await expect(page.getByText(/endpoint_overshoot/).first()).toBeVisible();

  await page.getByRole("button", { name: "Reset demo" }).click();
  await expect(page).toHaveURL(/\/demo$/);
  expect(
    await page.evaluate(() => localStorage.getItem("labbench.demo.trace.v1"))
  ).toBeNull();
  expect(browserErrors).toEqual([]);
});
