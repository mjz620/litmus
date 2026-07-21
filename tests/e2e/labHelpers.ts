import { expect, type Page } from "@playwright/test";

/**
 * Clear the pre-lab briefing.
 *
 * Every student-facing lab now opens on an overview of the objective,
 * procedure, and bench before the 3D workspace mounts. Specs that navigate
 * straight to a lab must pass through it to reach the bench. Teacher preview
 * skips the briefing, so calling this there is a no-op.
 */
export async function startLab(page: Page) {
  const start = page.getByRole("button", { name: "Start the lab" });
  if (await start.isVisible().catch(() => false)) {
    await start.click();
  }
  await expect(start).toBeHidden();
}

export async function openPrecisionControls(page: Page) {
  const toggle = page.getByRole("button", {
    name: "Precision controls",
    exact: true
  });
  await expect(toggle).toBeVisible();
  if ((await toggle.getAttribute("aria-pressed")) !== "true") {
    await toggle.click();
  }
  await expect(
    page.getByRole("complementary", { name: "Lab controls" })
  ).toBeVisible();
}

export async function openLabCoach(page: Page) {
  const dialog = page.getByRole("dialog", { name: "Lab coach" });
  if (await dialog.isVisible()) return;

  const toggle = page.getByRole("button", { name: /Ask lab coach/ });
  await expect(toggle).toBeVisible({ timeout: 30_000 });
  await toggle.click();
  await expect(dialog).toBeVisible();
}

export async function prepareBuretteWithTitrant(page: Page) {
  await page.getByRole("button", { name: "Select titrant" }).click();
  const funnel = page.getByRole("button", {
    name: /^(Select fill funnel|Funnel selected)$/
  });
  if ((await funnel.getAttribute("aria-pressed")) !== "true") {
    await funnel.click();
  }

  const rinse = page.getByRole("button", { name: "Rinse with titrant" });
  if (await rinse.isVisible()) await rinse.click();

  const fill = page.getByRole("button", { name: "Fill burette" });
  await expect(fill).toBeEnabled();
  await fill.click();
}

export async function addIndicator(
  page: Page,
  indicator: "phenolphthalein" | "bromothymol_blue" | "methyl_orange",
  label: string
) {
  await page.getByLabel("2. Indicator").selectOption(indicator);
  await page.getByRole("button", { name: "Review indicator details" }).click();
  const dialog = page.getByRole("dialog", {
    name: label
  });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: `Add ${label} to flask` }).click();
}
