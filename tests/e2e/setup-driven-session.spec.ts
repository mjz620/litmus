import { expect, test } from "@playwright/test";

test("explicit setup-v2 flag loads exact local runtime and dispatches its strict actions", async ({
  page
}) => {
  test.setTimeout(60_000);
  const browserErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  page.on("pageerror", (error) => browserErrors.push(error.message));

  await page.goto(
    "/dev/lab/titration?runtime=setup-v2&seed=setup-driven-browser"
  );
  await expect(page.getByText("Ready", { exact: true })).toBeVisible({
    timeout: 30_000
  });
  await expect(page.getByText("setup_driven_v2", { exact: true })).toBeVisible();
  await expect(page.getByTestId("dev-workflow-definition")).toContainText(
    "workflow.endpoint_control_prelab.seed.v1 @ sha256:4acc1b11"
  );
  await expect(page.getByTestId("dev-runtime-adapter")).toHaveText(
    "runtime-adapter.titration.v1 1.0.0"
  );

  await page.getByRole("button", { name: "Open precision controls" }).click();
  await page.getByRole("button", { name: "Meniscus", exact: true }).click();
  await page.getByRole("button", { name: "Use displayed reading" }).click();
  await page
    .getByRole("button", { name: "Record meniscus reading" })
    .click();
  await page.getByRole("button", { name: "Burette", exact: true }).click();
  await page.getByLabel("Volume to add (mL)").fill("0.10");
  await page.getByLabel("Delivery time (seconds)").fill("4");
  await page.getByRole("button", { name: "Add titrant", exact: true }).click();

  await expect(page.getByTestId("dev-event-count")).toHaveText("2");
  await expect(page.getByTestId("dev-raw-state")).toContainText(
    '"titrantAddedML": 22.1'
  );
  expect(browserErrors).toEqual([]);
});

test("runtime query defaults invalid and precipitation requests to legacy", async ({
  page
}) => {
  await page.goto("/dev/lab/titration?runtime=invalid");
  await expect(page.getByText("Ready", { exact: true })).toBeVisible();
  await expect(page.getByTestId("dev-workflow-definition")).toHaveText(
    "legacy route"
  );

  await page.goto("/dev/lab/precipitation?runtime=setup-v2");
  await expect(page.getByText("Ready", { exact: true })).toBeVisible();
  await expect(page.getByTestId("dev-workflow-definition")).toHaveText(
    "legacy route"
  );
});
