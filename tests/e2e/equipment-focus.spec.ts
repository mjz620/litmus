import { expect, test } from "@playwright/test";
import { createHash } from "node:crypto";

/**
 * Two properties of focusing a piece of equipment:
 *
 * 1. It zooms. Camera poses used to come from a hardcoded map covering only
 *    titration apparatus, so every registry-placed item fell through to the
 *    overview pose and selecting it did nothing at all.
 * 2. It does not leave the emissive shell drawn. Once the camera moves inside
 *    that shell it washes the viewport, hiding the controls the zoom exists to
 *    reach.
 */

const LABS: Array<[string, string]> = [
  ["calorimetry", "/lab/calorimetry"],
  ["precipitation", "/lab/silver-chloride"],
  ["solution preparation", "/lab/solution-preparation"]
];

for (const [lab, path] of LABS) {
  test(`every selectable item on the ${lab} bench zooms when focused`, async ({
    page
  }) => {
    test.setTimeout(240_000);
    await page.goto(path);
    const canvas = page.locator("canvas").first();
    await expect(canvas).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(2_200);

    const frameHash = async () =>
      createHash("sha1")
        .update(await canvas.screenshot())
        .digest("hex");

    const overview = await frameHash();
    const bar = page.getByRole("group", { name: "Selectable equipment" });
    const names = (await bar.getByRole("button").allInnerTexts()).filter(
      (name) => name && !name.includes("Back")
    );
    expect(names.length).toBeGreaterThan(0);

    for (const name of names) {
      const back = bar.getByRole("button", { name: /Back to full bench/ });
      if (await back.count()) {
        await back.click();
        await page.waitForTimeout(900);
      }
      await bar.getByRole("button", { name, exact: true }).click();
      await page.waitForTimeout(1_400);
      expect(await frameHash(), `${name} did not move the camera`).not.toBe(
        overview
      );
    }
  });
}

test("a focused item does not keep its highlight shell drawn", async ({
  page
}) => {
  test.setTimeout(120_000);
  await page.goto("/lab/calorimetry");
  await expect(page.locator("canvas").first()).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(2_000);

  const bar = page.getByRole("group", { name: "Selectable equipment" });
  await bar.getByRole("button").first().click();
  await page.waitForTimeout(1_400);
  // Move well clear so no hover is in play; a selected item must not glow.
  await page.mouse.move(4, 4);
  await page.waitForTimeout(500);

  await expect(
    page.locator('[data-equipment-hover-label][data-equipment-selected="true"]')
  ).toHaveCount(1);
});
