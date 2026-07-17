import { expect, type Page } from "@playwright/test";

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

export async function openLabNotebook(page: Page) {
  const summary = page.locator("summary").filter({ hasText: "Lab notebook" });
  await expect(summary).toBeVisible({ timeout: 30_000 });
  await summary.click();
  await expect(
    page.getByRole("complementary", { name: "Session notes" })
  ).toBeVisible();
}

export async function openPHGraph(page: Page) {
  const summary = page.locator("summary").filter({ hasText: "Live pH graph" });
  await expect(summary).toBeVisible({ timeout: 30_000 });
  await summary.click();
  await expect(page.getByRole("heading", { name: "pH curve" })).toBeVisible();
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
