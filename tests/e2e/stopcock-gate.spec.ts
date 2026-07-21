import { startLab } from "./labHelpers";
import { expect, test } from "@playwright/test";

/**
 * The v2 titration workflow makes dispensing available only after the initial
 * burette reading is recorded, so the stopcock is legitimately locked at the
 * start of an attempt. The bench must say so: previously it told the student to
 * "drag the bright blue stopcock handle" while the valve would refuse, which is
 * indistinguishable from a broken control.
 */
test("the burette hint reflects whether the stopcock will respond", async ({
  page
}) => {
  test.setTimeout(120_000);
  await page.goto("/lab/titration?runtime=setup-v2");
  await startLab(page);
  await expect(page.getByText("3D bench ready", { exact: true })).toBeVisible({
    timeout: 30_000
  });

  await page.getByRole("button", { name: "Burette", exact: true }).click();
  await page.waitForTimeout(800);

  const hint = page.locator("p[aria-live='polite']").filter({ hasText: "Burette:" });
  await expect(hint).toContainText("stays closed until the earlier steps are done");
  await expect(hint).not.toContainText("Drag the bright blue stopcock handle");
});

test("the instruction bar stays clear of the flask", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/lab/titration?runtime=setup-v2");
  await startLab(page);
  await expect(page.getByText("3D bench ready", { exact: true })).toBeVisible({
    timeout: 30_000
  });
  await page.getByRole("button", { name: "Burette", exact: true }).click();
  await page.waitForTimeout(1_400);

  const canvas = await page.locator("canvas").first().boundingBox();
  const bar = await page
    .locator("p")
    .filter({ hasText: "Burette:" })
    .first()
    .boundingBox();
  expect(canvas && bar).toBeTruthy();

  /*
   * The endpoint colour change is what the student watches, and the burette
   * focus pose frames the flask in the lower-middle of the canvas. The
   * instruction bar must stay in the bottom margin rather than covering it.
   */
  const barTopFraction = (bar!.y - canvas!.y) / canvas!.height;
  expect(barTopFraction).toBeGreaterThan(0.88);
});
