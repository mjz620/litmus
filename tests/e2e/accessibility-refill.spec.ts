import { expect, test } from "@playwright/test";

import {
  addIndicator,
  openPrecisionControls,
  startLab
} from "./labHelpers";

test("keyboard controls complete preparation, delivery, refill, and reading", async ({
  page
}) => {
  const browserErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  page.on("pageerror", (error) => browserErrors.push(error.message));

  await page.goto("/dev/lab/titration?seed=keyboard-refill");
  await expect(page.getByText("3D bench ready", { exact: true })).toBeVisible({
    timeout: 30_000
  });
  await openPrecisionControls(page);

  const titrant = page.getByRole("button", { name: "Select titrant" });
  await titrant.focus();
  await page.keyboard.press("Enter");
  const funnel = page.getByRole("button", { name: "Select fill funnel" });
  await funnel.focus();
  await page.keyboard.press("Enter");
  const rinse = page.getByRole("button", { name: "Rinse with titrant" });
  await rinse.focus();
  await page.keyboard.press("Enter");

  const fillAmount = page.getByLabel("Amount to add to burette (mL)");
  await fillAmount.focus();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.type("50");
  const initialFill = page.getByRole("button", { name: "Fill burette" });
  await initialFill.focus();
  await page.keyboard.press("Enter");

  await addIndicator(page, "phenolphthalein", "Phenolphthalein");

  const addition = page.getByLabel("Volume to add (mL)");
  await addition.focus();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.type("50");
  const duration = page.getByLabel("Delivery time (seconds)");
  await duration.focus();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.type("250");
  const add = page.getByRole("button", { name: "Add titrant", exact: true });
  await add.focus();
  await page.keyboard.press("Enter");

  await page.getByRole("button", { name: "Select titrant" }).click();
  await page.getByRole("button", { name: "Select fill funnel" }).click();
  await fillAmount.focus();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.type("12.5");
  const refill = page.getByRole("button", { name: "Add refill" });
  await refill.focus();
  await page.keyboard.press("Enter");

  const useReading = page.getByRole("button", {
    name: "Use displayed reading"
  });
  await useReading.focus();
  await page.keyboard.press("Enter");
  const recordReading = page.getByRole("button", {
    name: "Record meniscus reading"
  });
  await recordReading.focus();
  await page.keyboard.press("Enter");

  const rawState = JSON.parse(
    await page.getByTestId("dev-raw-state").innerText()
  );
  expect(rawState).toMatchObject({
    titrantAddedML: 50,
    buretteAvailableML: 12.5,
    buretteReadingML: 37.5,
    fillCount: 2
  });
  expect(rawState.fillHistory).toHaveLength(2);
  await expect(
    page.getByText("read_meniscus", { exact: true }).first()
  ).toBeVisible();
  expect(browserErrors).toEqual([]);
});

test("skip navigation and reduced-motion controls remain operable", async ({
  page
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/lab/titration?runtime=setup-v2");
  await startLab(page);

  await page.keyboard.press("Tab");
  const skipLink = page.getByRole("link", { name: "Skip to main content" });
  await expect(skipLink).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main-content")).toBeFocused();

  const reducedGraphics = page.getByRole("button", {
    name: "Reduced graphics"
  });
  await reducedGraphics.focus();
  await page.keyboard.press("Enter");
  await expect(reducedGraphics).toHaveAttribute("aria-pressed", "true");
  await openPrecisionControls(page);
  await expect(
    page.getByRole("button", { name: "Fill burette" })
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Select fill funnel" })
  ).toBeEnabled();
});
