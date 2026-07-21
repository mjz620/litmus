import { expect, test } from "@playwright/test";

test("renders the Litmus landing page", async ({ page }) => {
  const browserErrors: string[] = [];

  page.on("console", (message) => {
    if (message.type() === "error") {
      browserErrors.push(message.text());
    }
  });
  page.on("pageerror", (error) => browserErrors.push(error.message));

  await page.goto("/");

  await expect(
    page.getByRole("heading", { level: 1, name: "Litmus" })
  ).toBeVisible();
  expect(browserErrors).toEqual([]);
});
