import { startLab } from "./labHelpers";
import { expect, test } from "@playwright/test";

test("default titration student route loads the capability-native runtime", async ({
  page
}) => {
  test.setTimeout(60_000);
  await page.route("**/api/sessions/checkpoint", async (route) => {
    await route.fulfill({ status: 401 });
  });
  await page.goto("/lab/titration?seed=default-native");
  await startLab(page);
  await expect(page.getByText("3D bench ready", { exact: true })).toBeVisible({
    timeout: 30_000
  });
  await expect(page.locator("[data-workflow-id]").first()).toHaveAttribute(
    "data-workflow-id",
    "workflow.acid_base_titration.full.native.v2"
  );
  await expect(page.locator('svg[viewBox="0 0 64 64"]')).toHaveCount(2);
  await expect(page.getByText("Save failed", { exact: false })).toHaveCount(0);

  await page.getByRole("button", { name: "Reduced graphics" }).click();
  await page.getByRole("button", { name: "Wash station", exact: true }).click();
  const washPanel = page.locator('[data-focused-equipment="washStation"]');
  await expect(
    washPanel.getByText("Rinse the burette with titrant", { exact: true })
  ).toBeVisible();
  await expect(washPanel.getByLabel("Rinse liquid")).toHaveValue("titrant");
  await washPanel
    .getByRole("button", { name: "Apply", exact: true })
    .first()
    .click();
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "Next: Fill the burette with titrant." })
  ).toBeVisible();
  await expect(
    washPanel.getByText(
      "Completed — the burette is conditioned with titrant.",
      { exact: true }
    )
  ).toBeVisible();
});

test("?runtime=setup-v2 keeps the strangler rollback loading its workflow", async ({
  page
}) => {
  test.setTimeout(60_000);
  await page.goto("/lab/titration?seed=default-setup-driven&runtime=setup-v2");
  await startLab(page);
  await expect(page.getByText("3D bench ready", { exact: true })).toBeVisible({
    timeout: 30_000
  });
  await expect(page.locator("[data-runtime-mode]")).toHaveAttribute(
    "data-runtime-mode",
    "setup_driven_v2"
  );
});

test("explicit setup-v2 flag loads exact local runtime and dispatches its strict actions", async ({
  page
}) => {
  test.setTimeout(60_000);
  // Unauthenticated practice checkpoints legitimately return 401 and the
  // session tolerates them, but the browser still logs each as a console
  // error. Fulfil the save so the zero-console-error assertion below stays
  // about the runtime dispatch this test is actually verifying.
  await page.route("**/api/sessions/checkpoint", async (route) => {
    await route.fulfill({ status: 204 });
  });
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

test("setup-driven Coach labels authored guidance without exposing technical IDs", async ({
  page
}) => {
  await page.goto(
    "/dev/lab/titration?runtime=setup-v2&seed=authored-coach-browser"
  );
  await expect(page.getByText("3D bench ready", { exact: true })).toBeVisible({
    timeout: 30_000
  });
  await page.getByRole("button", { name: /Ask lab coach/ }).click();
  const dialog = page.getByRole("dialog", { name: "Lab coach" });
  await dialog
    .getByLabel("Ask about this lab")
    .fill("What should I focus on first?");
  await dialog.getByRole("button", { name: "Ask coach" }).click();

  await expect(dialog.getByText("AI guidance", { exact: true })).toBeVisible();
  await expect(dialog.getByText(/Coach: Use this lab guidance:/)).toBeVisible();
  await expect(dialog).not.toContainText("sha256:");
  await expect(dialog).not.toContainText("migration.rule");
});

test("student Coach keeps a question useful when the Coach route is unavailable", async ({
  page
}) => {
  await page.route("**/api/coach", async (route) => {
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: "unavailable" })
    });
  });
  await page.goto(
    "/dev/lab/titration?runtime=setup-v2&seed=authored-coach-offline-browser"
  );
  await expect(page.getByText("3D bench ready", { exact: true })).toBeVisible({
    timeout: 30_000
  });
  await page.getByRole("button", { name: /Ask lab coach/ }).click();
  const dialog = page.getByRole("dialog", { name: "Lab coach" });
  await dialog.getByLabel("Ask about this lab").fill("What should I do first?");
  await dialog.getByRole("button", { name: "Ask coach" }).click();

  await expect(dialog).toContainText("next available lab step");
  await expect(dialog).not.toContainText(/503|unavailable|request failed/i);
  await dialog
    .getByLabel("Ask about this lab")
    .fill("Can I ask another question?");
  await expect(dialog.getByRole("button", { name: "Ask coach" })).toBeEnabled();
});

test("runtime query keeps titration on setup-driven and rejects retired legacy routes", async ({
  page
}) => {
  await page.goto("/dev/lab/titration?runtime=invalid");
  await expect(page.getByText("Ready", { exact: true })).toBeVisible();
  await expect(page.getByTestId("dev-workflow-definition")).not.toHaveText(
    "legacy route"
  );

  // The legacy 2D precipitation experiment is retired; only the native
  // setup-driven silver-chloride lab remains, so this route must not resolve.
  await page.goto("/dev/lab/precipitation?runtime=setup-v2");
  await expect(
    page.getByText("Route unavailable", { exact: true })
  ).toBeVisible();
});
