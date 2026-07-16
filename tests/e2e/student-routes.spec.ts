import { expect, test } from "@playwright/test";

test("guest can open the experiment catalog and initialized titration shell", async ({
  page
}) => {
  const browserErrors: string[] = [];

  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  page.on("pageerror", (error) => browserErrors.push(error.message));

  await page.goto("/experiments");
  await expect(
    page.getByRole("heading", { level: 1, name: "Choose an experiment" })
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 2, name: "Acid–Base Titration" })
  ).toBeVisible();

  await page.getByRole("link", { name: "Start practice" }).click();
  await expect(page).toHaveURL(/\/lab\/titration$/);
  await expect(
    page.getByRole("heading", {
      level: 2,
      name: "Initialized state summary"
    })
  ).toBeVisible();
  await expect(page.getByText("Ready", { exact: true })).toBeVisible();
  const summary = page.getByRole("complementary", {
    name: "Initialized state summary"
  });
  await expect(
    summary
      .getByText("Titrant added", { exact: true })
      .locator("..")
      .getByText("0.00 mL", { exact: true })
  ).toBeVisible();
  await expect(
    summary
      .getByText("Titrant available", { exact: true })
      .locator("..")
      .getByText("0.00 mL", { exact: true })
  ).toBeVisible();
  await expect(page.getByText("4", { exact: true })).toBeVisible();
  expect(browserErrors).toEqual([]);
});

test("unknown experiment route returns a 404", async ({ page }) => {
  const response = await page.goto("/lab/not-a-real-experiment");

  expect(response?.status()).toBe(404);
  await expect(page.getByText("This page could not be found.")).toBeVisible();
});

test("new titration sessions receive fresh seeds and explicit seeds replay", async ({
  page
}) => {
  const summaryValue = (label: string) =>
    page
      .getByRole("complementary", { name: "Initialized state summary" })
      .getByText(label, { exact: true })
      .locator("..")
      .locator("dd");

  await page.goto("/lab/titration");
  await expect(page.getByText("Ready", { exact: true })).toBeVisible();
  const firstSeed = await summaryValue("Session seed").innerText();

  await page.reload();
  await expect(page.getByText("Ready", { exact: true })).toBeVisible();
  const secondSeed = await summaryValue("Session seed").innerText();

  expect(firstSeed).toMatch(/^guest-/);
  expect(secondSeed).toMatch(/^guest-/);
  expect(secondSeed).not.toBe(firstSeed);

  await page.goto("/lab/titration?seed=replay-alpha");
  await expect(page.getByText("Ready", { exact: true })).toBeVisible();
  await expect(summaryValue("Session seed")).toHaveText("replay-alpha");
  const replayedConfiguration = [
    (await summaryValue("Analyte").textContent()) ?? "",
    (await summaryValue("Titrant").textContent()) ?? ""
  ];

  await page.reload();
  await expect(page.getByText("Ready", { exact: true })).toBeVisible();
  await expect(summaryValue("Analyte")).toHaveText(replayedConfiguration[0]);
  await expect(summaryValue("Titrant")).toHaveText(replayedConfiguration[1]);

  await page.goto("/lab/titration?seed=replay-beta");
  await expect(page.getByText("Ready", { exact: true })).toBeVisible();
  const differentConfiguration = [
    (await summaryValue("Analyte").textContent()) ?? "",
    (await summaryValue("Titrant").textContent()) ?? ""
  ];

  expect(differentConfiguration).not.toEqual(replayedConfiguration);
});
