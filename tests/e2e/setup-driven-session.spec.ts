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
  await expect(page.getByText("3D bench ready", { exact: true })).toBeVisible({
    timeout: 30_000
  });
  await expect(
    page.getByText("setup_driven_v2", { exact: true })
  ).toBeVisible();
  await expect(page.getByTestId("dev-workflow-definition")).toContainText(
    "workflow.endpoint_control_prelab.seed.v1 @ sha256:4acc1b11"
  );
  await expect(page.getByTestId("dev-runtime-adapter")).toHaveText(
    "runtime-adapter.titration.v1 1.0.0"
  );
  const workspace = page.locator("[data-runtime-mode]");
  await expect(workspace).toHaveAttribute(
    "data-runtime-mode",
    "setup_driven_v2"
  );
  await expect(workspace).toHaveAttribute(
    "data-workflow-id",
    "workflow.endpoint_control_prelab.seed.v1"
  );
  await expect(
    page.getByRole("button", { name: "Wash station", exact: true })
  ).toHaveCount(0);
  await expect(page.locator("[data-contextual-prompt]")).toContainText(
    "record the displayed burette reading"
  );

  await page
    .getByRole("button", { name: "Precision controls", exact: true })
    .click();
  await expect(page.getByText("4. Read meniscus")).toBeVisible();
  await expect(page.getByText("3. Add titrant (stopcock)")).toHaveCount(0);
  await expect(page.getByText("1. Prepare burette")).toHaveCount(0);
  await page.getByRole("button", { name: "Meniscus", exact: true }).click();
  await page.getByRole("button", { name: "Use displayed reading" }).click();
  await page.getByRole("button", { name: "Record meniscus reading" }).click();
  await page.getByRole("button", { name: "Burette", exact: true }).click();
  await expect(page.getByText("3. Add titrant (stopcock)")).toBeVisible();
  await expect(page.getByText("4. Read meniscus")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Coarse 1.00 mL" })
  ).toBeDisabled();
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
