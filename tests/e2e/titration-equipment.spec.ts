import { expect, test } from "@playwright/test";

test("equipment selection shows contextual controls and completes the titration", async ({
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
  const buretteButton = page.getByRole("button", {
    name: "Burette",
    exact: true
  });
  const flaskButton = page.getByRole("button", { name: "Flask & indicator" });
  const meniscusButton = page.getByRole("button", {
    name: "Meniscus",
    exact: true
  });
  const exitButton = page.getByRole("button", { name: "← Back to full bench" });

  // Full bench: every control group is reachable, nothing selected.
  await expect(scene).toHaveAttribute("data-selected-equipment", "none");
  await expect(page.getByText("1. Prepare burette")).toBeVisible();
  await expect(page.getByLabel("2. Indicator")).toBeVisible();
  await expect(page.getByText("3. Add titrant (stopcock)")).toBeVisible();
  await expect(page.getByText("4. Read meniscus")).toBeVisible();

  // Keyboard focus announces the equipment name and purpose.
  await buretteButton.focus();
  await expect(
    page.getByText(
      "Burette: Rinse, fill, and deliver titrant through the stopcock."
    )
  ).toBeVisible();

  // Selecting the burette focuses its contextual controls only.
  await buretteButton.click();
  await expect(scene).toHaveAttribute("data-selected-equipment", "burette");
  await expect(page.getByText("1. Prepare burette")).toBeVisible();
  await expect(page.getByText("3. Add titrant (stopcock)")).toBeVisible();
  await expect(page.getByLabel("2. Indicator")).toHaveCount(0);
  await expect(page.getByText("4. Read meniscus")).toHaveCount(0);
  await expect(exitButton).toBeVisible();

  await page.getByRole("button", { name: "Rinse with titrant" }).click();
  await page.getByRole("button", { name: "Fill burette" }).click();
  await expect(scene).toHaveAttribute("data-burette-fill", "1.000");

  // Flask selection exposes the indicator controls only.
  await flaskButton.click();
  await expect(scene).toHaveAttribute("data-selected-equipment", "flask");
  await expect(page.getByLabel("2. Indicator")).toBeVisible();
  await expect(page.getByText("1. Prepare burette")).toHaveCount(0);
  await page.getByLabel("2. Indicator").selectOption("methyl_orange");

  // Back to the burette to deliver titrant through the stopcock controls.
  await buretteButton.click();
  await page.getByLabel("Volume to add (mL)").fill("0.10");
  await page.getByLabel("Delivery time (seconds)").fill("4");
  await page.getByRole("button", { name: "Add titrant", exact: true }).click();
  await expect(scene).toHaveAttribute("data-flask-color", "red");

  // Meniscus selection gives the eye-level reading controls only.
  await meniscusButton.click();
  await expect(scene).toHaveAttribute("data-selected-equipment", "meniscus");
  await expect(page.getByText("4. Read meniscus")).toBeVisible();
  await expect(page.getByText("1. Prepare burette")).toHaveCount(0);
  await page.getByRole("button", { name: "Use displayed reading" }).click();
  await page.getByRole("button", { name: "Record meniscus reading" }).click();

  const notebook = page.getByRole("complementary", { name: "Session notes" });
  await expect(
    notebook
      .getByRole("region", { name: "Recorded burette readings" })
      .getByText("0.10 mL")
  ).toBeVisible();

  // Escape exits the focused view and restores the full control set.
  await page.keyboard.press("Escape");
  await expect(scene).toHaveAttribute("data-selected-equipment", "none");
  await expect(page.getByText("1. Prepare burette")).toBeVisible();
  await expect(page.getByLabel("2. Indicator")).toBeVisible();
  await expect(exitButton).toHaveCount(0);

  expect(browserErrors).toEqual([]);
});

test("reduced graphics toggle keeps the scene and controls usable", async ({
  page
}) => {
  await page.goto("/lab/titration");
  await expect(page.getByText("3D bench ready", { exact: true })).toBeVisible({
    timeout: 30_000
  });

  const qualityToggle = page.getByRole("button", { name: "Reduced graphics" });
  await expect(qualityToggle).toHaveAttribute("aria-pressed", "false");

  await qualityToggle.click();
  await expect(qualityToggle).toHaveAttribute("aria-pressed", "true");

  const scene = page.getByRole("region", { name: "Interactive lab bench" });
  await expect(scene).toHaveAttribute("data-burette-fill", "0.000");
  await expect(
    page.getByRole("button", { name: "Fill burette" })
  ).toBeEnabled();
});
