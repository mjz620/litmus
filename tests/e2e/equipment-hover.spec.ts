import { startLab } from "./labHelpers";
import { expect, type Page, test } from "@playwright/test";

/**
 * 3D pointer events have no unit coverage — vitest has no WebGL context — so a
 * regression that made equipment unresponsive shipped once with a fully green
 * suite. These tests drive the real canvas.
 *
 * Two traps this avoids:
 *
 * 1. The equipment-bar buttons set hover state from their own `onMouseEnter`,
 *    and the HUD overlays the canvas. Every sampled point is checked with
 *    `elementFromPoint` so only genuine canvas pixels count.
 * 2. `data-hovered` on the scene frame is driven by the shared UI store, which
 *    is exactly what a 3D hover updates — a more robust signal than the
 *    floating label, which depends on additional render conditions.
 */

const SWEEP = Array.from({ length: 19 }, (_, index) => 0.05 + index * 0.05);

async function canvasHoverPoints(page: Page): Promise<number> {
  const canvas = page.locator("canvas").first();
  await expect(canvas).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(2_000);
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Lab canvas has no layout box.");
  const frame = page.locator("[data-hovered]").first();

  let hits = 0;
  for (const vertical of SWEEP) {
    for (const horizontal of SWEEP) {
      const x = box.x + box.width * horizontal;
      const y = box.y + box.height * vertical;
      const overCanvas = await page.evaluate(
        ([pointX, pointY]) =>
          document.elementFromPoint(pointX as number, pointY as number)
            ?.tagName === "CANVAS",
        [x, y]
      );
      if (!overCanvas) continue;

      await page.mouse.move(x, y, { steps: 2 });
      await page.waitForTimeout(40);
      if ((await frame.getAttribute("data-hovered")) !== "true") continue;

      // Hover must survive a settle. It previously cleared itself within a
      // frame, so a transient reading proved nothing.
      await page.waitForTimeout(250);
      if ((await frame.getAttribute("data-hovered")) !== "true") continue;
      // And it must actually surface the floating label to the student.
      await expect(page.locator("[data-equipment-hover-label]").first()).toBeVisible({
        timeout: 1_000
      });
      hits += 1;
      if (hits >= 2) return hits;
    }
  }
  return hits;
}

test("equipment on the setup-driven bench responds to canvas hover", async ({
  page
}) => {
  test.setTimeout(180_000);
  await page.goto("/lab/calorimetry");
  await startLab(page);

  expect(
    await canvasHoverPoints(page),
    "No canvas point reported equipment hover — pointer events are not reaching the 3D scene."
  ).toBeGreaterThan(0);
});

test("equipment on the titration bench responds to canvas hover", async ({
  page
}) => {
  test.setTimeout(180_000);
  await page.goto("/lab/titration?seed=hover-guard-1&runtime=setup-v2");
  await startLab(page);
  await expect(page.getByText("3D bench ready", { exact: true })).toBeVisible({
    timeout: 30_000
  });

  expect(await canvasHoverPoints(page)).toBeGreaterThan(0);
});

test("the precipitation bench lists only its own equipment", async ({
  page
}) => {
  test.setTimeout(120_000);
  await page.goto("/lab/silver-chloride");
  await startLab(page);
  const bar = page.getByRole("group", { name: "Selectable equipment" });
  await expect(bar).toBeVisible({ timeout: 30_000 });

  const names = await bar.getByRole("button").allInnerTexts();
  // Regression: reagent bottles were classified as titration's wash station in
  // any lab without a volumetric flask.
  expect(names).toContain("Beaker");
  expect(names.join(" ")).not.toContain("Wash station");
});
