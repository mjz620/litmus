import { expect, type Locator, test } from "@playwright/test";

import { openPrecisionControls } from "./labHelpers";

async function clickProjectedHotspot(hotspot: Locator) {
  await expect(hotspot).toBeVisible();
  await hotspot.click();
}

test("physical shelf and wash-station gestures complete a titration", async ({
  page
}) => {
  test.setTimeout(45_000);
  const browserErrors: string[] = [];

  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  page.on("pageerror", (error) => browserErrors.push(error.message));

  // This deterministic session has a 20.00 mL equivalence point.
  await page.goto("/lab/titration?seed=t0112-physical-3&runtime=setup-v2");
  await expect(page.getByText("3D bench ready", { exact: true })).toBeVisible({
    timeout: 30_000
  });
  await page.getByRole("button", { name: "Reduced graphics" }).click();

  const scene = page.getByRole("region", { name: "Interactive lab bench" });

  await page
    .getByRole("button", { name: "Indicator shelf", exact: true })
    .click();
  await expect(scene).toHaveAttribute(
    "data-selected-equipment",
    "indicatorShelf"
  );
  await page.waitForTimeout(700);

  await clickProjectedHotspot(
    page.locator('[data-indicator-bottle-hotspot="methyl_orange"]')
  );
  const indicatorDialog = page.getByRole("dialog", { name: "Methyl orange" });
  await expect(indicatorDialog).toBeVisible();
  await expect(
    indicatorDialog.getByText("pH 3.1–4.4", { exact: true })
  ).toBeVisible();
  await expect(indicatorDialog.getByText("red", { exact: true })).toBeVisible();
  await expect(
    indicatorDialog.getByText("orange", { exact: true })
  ).toBeVisible();
  await expect(
    indicatorDialog.getByText("yellow", { exact: true })
  ).toBeVisible();
  await expect(scene).toHaveAttribute("data-selected-indicator", "none");
  await indicatorDialog
    .getByRole("button", { name: "Add Methyl orange to flask" })
    .click();
  await expect(
    page.getByText("Adding Methyl orange to the flask…")
  ).toBeVisible();
  await expect(scene).toHaveAttribute(
    "data-selected-indicator",
    "methyl_orange"
  );
  await expect(scene).toHaveAttribute("data-indicator-added", "true");
  await expect(scene).toHaveAttribute("data-selected-equipment", "flask");

  await page
    .getByRole("button", { name: "Indicator shelf", exact: true })
    .click();
  await page.waitForTimeout(700);
  await expect(
    page.locator('[data-indicator-bottle-hotspot="phenolphthalein"]')
  ).toHaveCount(0);

  await page.getByRole("button", { name: "Wash station", exact: true }).click();
  await expect(scene).toHaveAttribute("data-selected-equipment", "washStation");
  await page.waitForTimeout(700);

  await clickProjectedHotspot(
    page.locator('[data-wash-station-hotspot="water"]')
  );
  await expect(scene).toHaveAttribute("data-wash-liquid", "water");
  await expect(scene).toHaveAttribute("data-funnel-selected", "false");
  await expect(scene).toHaveAttribute("data-burette-conditioned", "false");

  await clickProjectedHotspot(
    page.locator('[data-wash-station-hotspot="titrant"]')
  );
  await expect(scene).toHaveAttribute("data-wash-liquid", "titrant");
  await expect(scene).toHaveAttribute("data-burette-conditioned", "false");

  await clickProjectedHotspot(
    page.locator('[data-wash-station-hotspot="funnel"]')
  );
  await expect(scene).toHaveAttribute("data-funnel-selected", "true");
  await page.getByRole("button", { name: "Rinse with titrant" }).click();
  await expect(scene).toHaveAttribute("data-burette-conditioned", "true");
  await page.getByRole("button", { name: "Fill burette" }).click();
  await expect(scene).toHaveAttribute("data-burette-fill", "1.000");

  await page.getByRole("button", { name: "Burette", exact: true }).click();
  await openPrecisionControls(page);
  await page.getByLabel("Volume to add (mL)").fill("50");
  await page.getByLabel("Delivery time (seconds)").fill("100");
  await page.getByRole("button", { name: "Add titrant", exact: true }).click();

  await expect(scene).toHaveAttribute("data-burette-fill", "0.000");
  await expect(scene).toHaveAttribute("data-flask-color", "yellow");
  expect(browserErrors).toEqual([]);
});
