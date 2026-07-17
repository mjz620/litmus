import { expect, test } from "@playwright/test";

test("typography tokens cover student, coach, controls, and teacher surfaces", async ({
  page
}) => {
  await page.setViewportSize({ width: 1440, height: 1100 });

  await page.goto("/experiments");
  await expect(
    page.getByRole("heading", { name: "Choose an experiment" })
  ).toBeVisible();
  await expect(page.locator("body")).toHaveCSS("font-family", /neulis-sans/);
  await expect(
    page.getByRole("heading", { name: "Choose an experiment" })
  ).toHaveCSS("font-family", /tomarik-display/);
  await page.screenshot({
    path: "/tmp/typography-experiment-selection.png",
    fullPage: true
  });

  await page.goto("/lab/titration?seed=typography-review");
  await expect(page.getByText("3D bench ready", { exact: true })).toBeVisible({
    timeout: 30_000
  });
  await page.screenshot({
    path: "/tmp/typography-in-lab-hud.png",
    fullPage: true
  });

  const notebook = page.locator("summary").filter({ hasText: "Lab notebook" });
  await notebook.click();
  await expect(
    page.getByRole("complementary", { name: "Session notes" })
  ).toBeVisible();
  await page.screenshot({
    path: "/tmp/typography-procedure-panel.png",
    fullPage: true
  });

  await page
    .getByRole("button", { name: "Precision controls", exact: true })
    .click();
  await expect(
    page.getByRole("complementary", { name: "Lab controls" })
  ).toBeVisible();
  await page.screenshot({
    path: "/tmp/typography-equipment-controls.png",
    fullPage: true
  });

  await page.getByRole("button", { name: "Close precision controls" }).click();
  await page.getByRole("button", { name: /Ask lab coach/ }).click();
  await expect(page.getByRole("dialog", { name: "Lab coach" })).toBeVisible();
  await page.screenshot({
    path: "/tmp/typography-coach-panel.png",
    fullPage: true
  });

  await page.goto("/demo/teacher");
  await expect(
    page.getByRole("heading", { name: "Chemistry 1 — Demo readiness" })
  ).toBeVisible();
  await page.screenshot({
    path: "/tmp/typography-teacher-dashboard.png",
    fullPage: true
  });
});
