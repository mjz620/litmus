import { startLab } from "./labHelpers";
import { expect, test, type Page } from "@playwright/test";

function trackBrowserErrors(page: Page) {
  const errors: string[] = [];

  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));

  return errors;
}

test("look mode activates, contains canvas scroll, supports keyboard, and releases", async ({
  page
}) => {
  test.setTimeout(60_000);
  const browserErrors = trackBrowserErrors(page);

  await page.goto("/lab/titration?seed=t0103-camera&runtime=setup-v2");
  await startLab(page);
  await expect(page.getByText("3D bench ready", { exact: true })).toBeVisible({
    timeout: 30_000
  });
  await page.getByRole("button", { name: "Reduced graphics" }).click();

  const scene = page.getByRole("region", { name: "Interactive lab bench" });
  const frame = page.getByRole("application", {
    name: "Interactive 3D lab camera"
  });
  const canvas = frame.locator("canvas");
  const frameBounds = await frame.boundingBox();
  if (!frameBounds) throw new Error("Camera frame has no browser bounds.");

  await expect(
    page.getByText(
      "Click the simulation panel to initiate panning, then move the cursor toward its edges."
    )
  ).toBeVisible();
  await expect(scene).toHaveAttribute("data-look-active", "false");
  await frame.click({
    position: {
      x: frameBounds.width * 0.9,
      y: frameBounds.height * 0.1
    }
  });
  await expect(scene).toHaveAttribute("data-look-active", "true");
  await expect(
    page.getByText(
      "Looking around — move cursor to edges to pan · Esc to release"
    )
  ).toBeVisible();

  const scrollBeforeCanvasWheel = await page.evaluate(() => window.scrollY);
  await page.mouse.move(
    frameBounds.x + frameBounds.width * 0.75,
    frameBounds.y + frameBounds.height * 0.5
  );
  await page.mouse.wheel(0, 500);
  await expect
    .poll(() => page.evaluate(() => window.scrollY))
    .toBe(scrollBeforeCanvasWheel);

  const maxScrollY = await page.evaluate(
    () => document.documentElement.scrollHeight - window.innerHeight
  );
  const outsideWheelDelta =
    scrollBeforeCanvasWheel < maxScrollY / 2 ? 600 : -600;
  await page.mouse.move(8, 8);
  await page.mouse.wheel(0, outsideWheelDelta);
  await expect
    .poll(() => page.evaluate(() => window.scrollY))
    .not.toBe(scrollBeforeCanvasWheel);

  await page.evaluate(() => window.scrollTo(0, 0));
  await frame.scrollIntoViewIfNeeded();
  const restoredBounds = await frame.boundingBox();
  if (!restoredBounds) throw new Error("Camera frame lost its browser bounds.");
  await page.getByRole("button", { name: "Recenter view" }).click();
  await page.mouse.move(
    restoredBounds.x + restoredBounds.width / 2,
    restoredBounds.y + restoredBounds.height / 2
  );
  await page.waitForTimeout(100);
  const centered = await canvas.screenshot();

  await page.mouse.move(
    restoredBounds.x + restoredBounds.width * 0.98,
    restoredBounds.y + restoredBounds.height / 2
  );
  await page.waitForTimeout(350);
  const edgePanned = await canvas.screenshot();
  expect(edgePanned.equals(centered)).toBe(false);

  await page.getByRole("button", { name: "Recenter view" }).click();
  await page.mouse.move(
    restoredBounds.x + restoredBounds.width / 2,
    restoredBounds.y + restoredBounds.height / 2
  );
  await page.waitForTimeout(100);

  await frame.press("ArrowRight");
  const stepped = await canvas.screenshot();
  expect(stepped.equals(centered)).toBe(false);

  await page.getByRole("button", { name: "Recenter view" }).click();
  await page.mouse.move(
    restoredBounds.x + restoredBounds.width / 2,
    restoredBounds.y + restoredBounds.height / 2
  );
  await page.waitForTimeout(100);
  const recentered = await canvas.screenshot();
  expect(recentered.equals(stepped)).toBe(false);

  await frame.press("Escape");
  await expect(scene).toHaveAttribute("data-look-active", "false");

  await frame.click({
    position: {
      x: frameBounds.width * 0.9,
      y: frameBounds.height * 0.1
    }
  });
  await expect(scene).toHaveAttribute("data-look-active", "true");
  await page.getByRole("button", { name: "Reduced graphics" }).click();
  await expect(scene).toHaveAttribute("data-look-active", "false");

  await frame.click({
    position: {
      x: frameBounds.width * 0.9,
      y: frameBounds.height * 0.1
    }
  });
  await expect(scene).toHaveAttribute("data-look-active", "true");
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await expect(scene).toHaveAttribute("data-look-active", "false");

  expect(browserErrors).toEqual([]);
});

test("reduced motion disables continuous edge pan but keeps step look", async ({
  page
}) => {
  test.setTimeout(45_000);
  const browserErrors = trackBrowserErrors(page);
  await page.emulateMedia({ reducedMotion: "reduce" });

  await page.goto("/lab/titration?seed=t0103-reduced&runtime=setup-v2");
  await startLab(page);
  await expect(page.getByText("3D bench ready", { exact: true })).toBeVisible({
    timeout: 30_000
  });
  await page.getByRole("button", { name: "Reduced graphics" }).click();

  const scene = page.getByRole("region", { name: "Interactive lab bench" });
  const frame = page.getByRole("application", {
    name: "Interactive 3D lab camera"
  });
  const canvas = frame.locator("canvas");
  const frameBounds = await frame.boundingBox();
  if (!frameBounds) throw new Error("Camera frame has no browser bounds.");

  await frame.click({
    position: {
      x: frameBounds.width * 0.9,
      y: frameBounds.height * 0.1
    }
  });
  await expect(scene).toHaveAttribute("data-look-active", "true");
  await page.getByRole("button", { name: "Recenter view" }).click();
  await page.mouse.move(
    frameBounds.x + frameBounds.width * 0.98,
    frameBounds.y + frameBounds.height * 0.5
  );
  await page.waitForTimeout(100);
  const beforeEdge = await canvas.screenshot();
  await page.waitForTimeout(500);
  const afterEdge = await canvas.screenshot();
  expect(afterEdge.equals(beforeEdge)).toBe(true);

  await frame.press("ArrowLeft");
  const afterStep = await canvas.screenshot();
  expect(afterStep.equals(beforeEdge)).toBe(false);

  expect(browserErrors).toEqual([]);
});
