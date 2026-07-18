import { expect, test } from "@playwright/test";

test("teacher composes setup and workflow through bounded registered controls", async ({
  page
}) => {
  const browserErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("requestfailed", (request) =>
    browserErrors.push(
      `REQUEST ${request.url()}: ${request.failure()?.errorText ?? "failed"}`
    )
  );
  page.on("response", (response) => {
    if (response.status() >= 400)
      browserErrors.push(`HTTP ${response.status()} ${response.url()}`);
  });
  await page.goto("/teacher/lab-composer");

  await expect(
    page.getByRole("heading", { name: "Compose a verified lab" })
  ).toBeVisible();
  await expect(page.getByText("Draft unvalidated")).toBeVisible();
  await expect(page.getByRole("button", { name: "Preview" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Assign" })).toBeDisabled();
  const reagentCard = page
    .getByRole("article")
    .filter({ hasText: "Reagent bottle" });
  await reagentCard.getByRole("button", { name: "Add" }).click();
  await page.waitForTimeout(250);
  expect(browserErrors).toEqual([]);
  await expect(page.getByLabel("Selected instance")).toHaveValue(
    /teacher\.component_reagent_bottle_v1\./
  );
  await expect(
    page.getByText("visual-adapter.reagent_bottle.v1")
  ).toBeVisible();

  await page.getByLabel("Material").selectOption("reagent.distilled_water.v1");
  await page.getByRole("button", { name: "Bind material" }).click();
  await expect(page.getByText(/Revision 3/)).toBeVisible();

  await page
    .getByRole("combobox", { name: "Equipment", exact: true })
    .selectOption({ label: "Reagent bottle" });
  await expect(page.getByLabel("Supported slot")).toHaveValue(
    "placement.reagent_station.v1"
  );
  await page.getByRole("button", { name: "Place", exact: true }).click();
  await expect(
    page.getByRole("button", {
      name: /Liquid-source placement.*Reagent bottle/
    })
  ).toHaveAttribute("data-occupied", "true");

  await page.getByLabel("Selected instance").selectOption("titrant_burette");
  await page.getByRole("button", { name: "Remove instance" }).click();
  const editError = page
    .getByRole("alert")
    .filter({ hasText: "That edit was not applied" });
  await expect(editError).toContainText("That edit was not applied");
  await expect(editError).toContainText(
    "compatibility.equipmentRoleBindings[0].equipmentInstanceId"
  );

  await page.getByRole("tab", { name: "Workflow & assessment" }).click();
  await expect(
    page.getByRole("heading", { name: "Ordering dependencies" })
  ).toBeVisible();

  await page.getByLabel("Kind").selectOption("best_practice");
  await page.getByRole("button", { name: "Add action-evidence rule" }).click();
  await expect(
    page.getByRole("strong").filter({ hasText: /teacher\.action_rule\./ })
  ).toBeVisible();

  await page.getByLabel("Minimum").fill("24.98");
  await page
    .getByRole("spinbutton", { name: "Maximum", exact: true })
    .fill("25.02");
  await page.getByRole("button", { name: "Add tolerance" }).click();
  await expect(
    page.getByRole("strong").filter({ hasText: /teacher\.tolerance\./ })
  ).toBeVisible();

  await page.getByLabel("Title").fill("Observe the endpoint");
  await page
    .getByLabel("Guidance")
    .fill("Use the registered indicator response as evidence.");
  await page.getByRole("button", { name: "Add instruction" }).click();
  await expect(page.getByText("Observe the endpoint")).toBeVisible();

  await page.getByLabel("Description").fill("Documents endpoint evidence");
  await page.getByRole("button", { name: "Add criterion" }).click();
  await expect(page.getByText("Documents endpoint evidence")).toBeVisible();
  await expect(page.getByRole("button", { name: "Preview" })).toBeDisabled();
  expect(browserErrors).toEqual([]);
});

test("composer remains keyboard reachable without horizontal overflow on a student Chromebook viewport", async ({
  page
}) => {
  await page.setViewportSize({ width: 768, height: 900 });
  await page.goto("/teacher/lab-composer");
  const workflowTab = page.getByRole("tab", {
    name: "Workflow & assessment"
  });
  await expect(page.getByText("Draft unvalidated")).toBeVisible();
  await workflowTab.focus();
  await workflowTab.press("Space");
  await expect(
    page.getByRole("heading", { name: "Assessment rubric" })
  ).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth)
  ).toBeLessThanOrEqual(768);
});
