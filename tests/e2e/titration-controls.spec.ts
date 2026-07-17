import { expect, test } from "@playwright/test";

test("titration controls dispatch typed actions and update engine state", async ({
  page
}) => {
  const browserErrors: string[] = [];

  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  page.on("pageerror", (error) => browserErrors.push(error.message));

  await page.goto("/lab/titration");
  await expect(page.getByText("3D bench ready", { exact: true })).toBeVisible({
    timeout: 30_000
  });
  const scene = page.getByRole("region", { name: "Interactive lab bench" });
  const notebook = page.getByRole("complementary", { name: "Session notes" });
  await expect(scene).toHaveAttribute("data-burette-fill", "0.000");
  await expect(scene).toHaveAttribute("data-flask-color", "colorless");
  await expect(
    page.getByText("Add titrant to record the first pH measurement.")
  ).toBeVisible();
  await expect(notebook.getByText("Prepare the burette")).toBeVisible();

  const fillButton = page.getByRole("button", { name: "Fill burette" });
  const addButton = page.getByRole("button", {
    name: "Add titrant",
    exact: true
  });

  await expect(fillButton).toBeEnabled();
  await expect(addButton).toBeDisabled();

  await page.getByRole("button", { name: "Rinse with water" }).click();
  await expect(
    page.getByText("Rinsed with water — dilution risk", { exact: true })
  ).toBeVisible();

  await page.getByRole("button", { name: "Rinse with titrant" }).click();
  await expect(
    page.getByText("Conditioned with titrant", { exact: true })
  ).toBeVisible();

  await fillButton.click();
  await expect(scene).toHaveAttribute("data-burette-fill", "1.000");
  await expect(fillButton).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Rinse with titrant" })
  ).toBeDisabled();
  await expect(addButton).toBeEnabled();
  await expect(
    page.getByText("50.00 mL available", { exact: true })
  ).toBeVisible();
  await expect(notebook.getByText("Titrate toward the endpoint")).toBeVisible();

  await page.getByLabel("2. Indicator").selectOption("methyl_orange");
  await expect(
    notebook.getByText("methyl orange", { exact: true })
  ).toBeVisible();

  await page.getByLabel("Volume to add (mL)").fill("0.10");
  await page.getByLabel("Delivery time (seconds)").fill("4");
  await addButton.click();
  await expect(scene).toHaveAttribute("data-burette-fill", "0.998");
  await expect(scene).toHaveAttribute("data-flask-color", "red");

  await expect(
    page.getByText("0.10 mL", { exact: true }).first()
  ).toBeVisible();
  await expect(
    page.getByText("49.90 mL available", { exact: true })
  ).toBeVisible();
  await expect(notebook.getByText("Measured pH")).toBeVisible();
  await expect(notebook.getByText("red", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("img", {
      name: /Curve contains 1 measurement.*0.10 mL titrant added, pH \d+\.\d{2}/
    })
  ).toBeVisible();

  await page.getByRole("button", { name: "Use displayed reading" }).click();
  await page.getByRole("button", { name: "Record meniscus reading" }).click();

  await expect(
    notebook
      .getByRole("region", { name: "Recorded burette readings" })
      .getByText("0.10 mL")
  ).toBeVisible();
  await expect(notebook.getByText("Record your readings")).toBeVisible();
  expect(browserErrors).toEqual([]);
});
