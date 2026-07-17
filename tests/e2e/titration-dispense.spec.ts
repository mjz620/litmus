import { expect, test } from "@playwright/test";

import {
  addIndicator,
  openPrecisionControls,
  prepareBuretteWithTitrant
} from "./labHelpers";

test("holding at slow flow commits segmented titrant additions", async ({
  page
}) => {
  const browserErrors: string[] = [];

  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  page.on("pageerror", (error) => browserErrors.push(error.message));

  await page.goto("/dev/lab/titration?seed=t0130-hold");
  await expect(page.getByText("3D bench ready", { exact: true })).toBeVisible({
    timeout: 30_000
  });
  await openPrecisionControls(page);

  const scene = page.getByRole("region", { name: "Interactive lab bench" });
  await prepareBuretteWithTitrant(page);
  await addIndicator(page, "phenolphthalein", "Phenolphthalein");
  await expect(scene).toHaveAttribute("data-burette-fill", "1.000");
  await expect(page.getByTestId("dev-event-count")).toHaveText("3");

  await page.getByLabel("Flow detent").selectOption("slow");
  const holdButton = page.locator("button[data-dispensing]");
  await holdButton.scrollIntoViewIfNeeded();
  await holdButton.hover();
  await page.mouse.down();
  await expect(holdButton).toHaveAttribute("data-dispensing", "true");
  await page.waitForTimeout(3_100);
  await page.mouse.up();

  await expect(holdButton).toHaveAttribute("data-dispensing", "false");
  await expect
    .poll(async () => Number(await scene.getAttribute("data-burette-fill")))
    .toBeLessThan(1);
  await expect
    .poll(async () =>
      Number(await page.getByTestId("dev-event-count").innerText())
    )
    .toBeGreaterThanOrEqual(4);
  await expect(
    page
      .getByText("Latest event")
      .locator("..")
      .getByText("add_titrant", { exact: true })
  ).toBeVisible();

  const rawState = page.getByTestId("dev-raw-state");
  const beforeDrop = JSON.parse(await rawState.innerText()).titrantAddedML;
  await page.getByLabel("Flow detent").selectOption("dropwise");
  await holdButton.focus();
  await page.keyboard.down("Space");
  await page.keyboard.down("Space");
  await page.waitForTimeout(50);
  await page.keyboard.up("Space");

  await expect
    .poll(async () => JSON.parse(await rawState.innerText()).titrantAddedML)
    .toBeCloseTo(beforeDrop + 0.05, 5);
  expect(browserErrors).toEqual([]);
});
