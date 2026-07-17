import { expect, type Locator, test } from "@playwright/test";

async function clickProjectedHotspot(hotspot: Locator) {
  await expect(hotspot).toBeVisible();
  await hotspot.click();
}

test("physical shelf and wash-station gestures complete a titration", async ({
  page
}) => {
  const browserErrors: string[] = [];

  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  page.on("pageerror", (error) => browserErrors.push(error.message));

  // This deterministic session has a 20.00 mL equivalence point.
  await page.goto("/lab/titration?seed=t0112-physical-3");
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

  for (const indicator of [
    "bromothymol_blue",
    "phenolphthalein",
    "methyl_orange"
  ] as const) {
    await clickProjectedHotspot(
      page.locator(`[data-indicator-bottle-hotspot="${indicator}"]`)
    );
    await expect(page.getByLabel("2. Indicator")).toHaveValue(indicator);
  }
  await expect(page.getByLabel("2. Indicator")).toHaveValue("methyl_orange");

  await page.getByRole("button", { name: "Wash station", exact: true }).click();
  await expect(scene).toHaveAttribute("data-selected-equipment", "washStation");
  await page.waitForTimeout(700);

  await clickProjectedHotspot(
    page.locator('[data-wash-station-hotspot="water"]')
  );
  await expect(
    page.getByText("Rinsed with water — dilution risk", { exact: true })
  ).toBeVisible();

  await clickProjectedHotspot(
    page.locator('[data-wash-station-hotspot="titrant"]')
  );
  await expect(
    page.getByText("Conditioned with titrant", { exact: true })
  ).toBeVisible();

  await clickProjectedHotspot(
    page.locator('[data-wash-station-hotspot="funnel"]')
  );
  await expect(scene).toHaveAttribute("data-burette-fill", "1.000");

  await page.getByRole("button", { name: "Burette", exact: true }).click();
  await page.getByLabel("Volume to add (mL)").fill("50");
  await page.getByLabel("Delivery time (seconds)").fill("100");
  await page.getByRole("button", { name: "Add titrant", exact: true }).click();

  await expect(scene).toHaveAttribute("data-burette-fill", "0.000");
  await expect(scene).toHaveAttribute("data-flask-color", "yellow");
  expect(browserErrors).toEqual([]);
});
