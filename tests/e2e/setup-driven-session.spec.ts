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

test("setup-driven demo records workflow, diagnosis, and replay provenance for technical inspection", async ({
  page
}) => {
  await page.goto("/demo/student?runtime=setup-v2");
  await expect(page.getByText("3D bench ready", { exact: true })).toBeVisible({
    timeout: 30_000
  });
  await expect(page.locator("[data-runtime-mode]")).toHaveAttribute(
    "data-runtime-mode",
    "setup_driven_v2"
  );
  await page
    .getByRole("button", { name: "Precision controls", exact: true })
    .click();
  await page.getByRole("button", { name: "Meniscus", exact: true }).click();
  await page.getByRole("button", { name: "Use displayed reading" }).click();
  await page.getByRole("button", { name: "Record meniscus reading" }).click();

  await expect
    .poll(async () =>
      page.evaluate(() => {
        const raw = localStorage.getItem("labbench.demo.trace.v1");
        if (!raw) return null;
        const trace = JSON.parse(raw) as {
          labWorkflowContext?: { eventEnvelopes?: unknown[] };
          normalizedActionTrace?: { actions?: unknown[] };
        };
        return {
          eventCount: trace.labWorkflowContext?.eventEnvelopes?.length,
          actionCount: trace.normalizedActionTrace?.actions?.length
        };
      })
    )
    .toEqual({ eventCount: 1, actionCount: 1 });

  await page.goto("/demo/technical");
  await expect(
    page.getByRole("heading", { name: "Live technical trace" })
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Validated workflow provenance" })
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Workflow consumer context" })
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Normalized replay trace" })
  ).toBeVisible();
  await expect(
    page.getByText("workflow.endpoint_control_prelab.seed.v1").first()
  ).toBeVisible();
});
