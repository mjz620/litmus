import { expect, test } from "@playwright/test";

import { openLabNotebook } from "./labHelpers";

test("guest can open the experiment catalog and student lab notebook", async ({
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

  await page
    .getByRole("article")
    .filter({ hasText: "Acid–Base Titration" })
    .getByRole("link", { name: "Start practice" })
    .click();
  await expect(page).toHaveURL(/\/lab\/titration$/);
  await openLabNotebook(page);

  const notebook = page.getByRole("complementary", { name: "Session notes" });
  await expect(
    notebook.getByRole("heading", { level: 2, name: "Session notes" })
  ).toBeVisible();
  await expect(notebook.getByText("concentration unknown")).toBeVisible();
  await expect(notebook.getByText("Prepare the burette")).toBeVisible();
  await expect(
    page.getByText(/Practice mode — ready|Progress saved/)
  ).toBeVisible();

  const bodyText = (await page.locator("body").innerText()).toLowerCase();
  expect(bodyText).not.toContain("session seed");
  expect(bodyText).not.toContain("events recorded");
  expect(bodyText).not.toContain("skills tracked");
  expect(bodyText).not.toContain("acid_base_titration");
  expect(bodyText).not.toContain("initialized state summary");
  expect(bodyText).not.toContain("guest-");
  expect(browserErrors).toEqual([]);
});

test("unknown experiment route returns a 404", async ({ page }) => {
  const response = await page.goto("/lab/not-a-real-experiment");

  expect(response?.status()).toBe(404);
  await expect(page.getByText("This page could not be found.")).toBeVisible();
});

test("dev route shows fresh seeds per session and replays explicit seeds", async ({
  page
}) => {
  const devSeed = page.getByTestId("dev-session-seed");
  const devConfig = page.getByTestId("dev-config");

  await page.goto("/dev/lab/titration");
  await expect(page.getByText("Ready", { exact: true })).toBeVisible();
  const firstSeed = await devSeed.innerText();

  await page.reload();
  await expect(page.getByText("Ready", { exact: true })).toBeVisible();
  const secondSeed = await devSeed.innerText();

  expect(firstSeed).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
  );
  expect(secondSeed).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
  );
  expect(secondSeed).not.toBe(firstSeed);

  await page.goto("/dev/lab/titration?seed=replay-alpha");
  await expect(page.getByText("Ready", { exact: true })).toBeVisible();
  await expect(devSeed).toHaveText("replay-alpha");
  const replayedConfiguration = await devConfig.innerText();

  await page.reload();
  await expect(page.getByText("Ready", { exact: true })).toBeVisible();
  await expect(devConfig).toHaveText(replayedConfiguration);

  await page.goto("/dev/lab/titration?seed=replay-beta");
  await expect(page.getByText("Ready", { exact: true })).toBeVisible();
  const differentConfiguration = await devConfig.innerText();

  expect(differentConfiguration).not.toBe(replayedConfiguration);
});

test("dev route is unmistakably marked and links back to the student route", async ({
  page
}) => {
  await page.goto("/dev/lab/titration?seed=replay-alpha");

  await expect(page.getByText("⚠ Developer testing route")).toBeVisible();

  const studentLink = page.getByRole("link", {
    name: "Open the student route →"
  });
  await expect(studentLink).toHaveAttribute(
    "href",
    "/lab/titration?seed=replay-alpha"
  );
});
