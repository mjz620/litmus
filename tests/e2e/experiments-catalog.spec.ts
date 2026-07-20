import { expect, test } from "@playwright/test";

/**
 * The 2D precipitation lab is superseded by the native workflow on the shared
 * 3D bench, so students must not be offered both.
 */
test("the catalog offers the 3D precipitation lab and not the 2D one", async ({
  page
}) => {
  test.setTimeout(60_000);
  await page.goto("/experiments");
  const catalog = page.getByRole("region", { name: "Available experiments" });
  await expect(catalog).toBeVisible({ timeout: 30_000 });

  await expect(
    catalog.getByRole("heading", { name: "Silver chloride precipitation" })
  ).toBeVisible();
  await expect(
    catalog.getByRole("heading", { name: "Precipitation & Solubility" })
  ).toHaveCount(0);
  // The remaining registry lab is unaffected.
  await expect(
    catalog.getByRole("heading", { name: "Acid–Base Titration" })
  ).toBeVisible();
});
