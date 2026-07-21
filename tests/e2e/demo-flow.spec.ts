import { expect, test } from "@playwright/test";

/**
 * The judge demo is a controlled environment: the product's real interfaces,
 * served from /demo and backed by /api/demo endpoints. These assertions cover
 * what makes that claim true — the journey stays inside the area, and the
 * isolated production endpoints are never called from it.
 */
const ISOLATED_PRODUCTION_ENDPOINTS = [
  "/api/coach",
  "/api/evaluate",
  "/api/sessions/checkpoint"
];

test("the judge demo runs a real lab without leaving its isolated area", async ({
  page
}) => {
  test.setTimeout(120_000);
  const requested: string[] = [];
  page.on("request", (request) => {
    const { pathname } = new URL(request.url());
    if (pathname.startsWith("/api/")) requested.push(pathname);
  });

  await page.goto("/demo");
  await expect(
    page.getByRole("heading", { name: "Litmus product demo" })
  ).toBeVisible();

  // Student entry point lists the representative labs.
  await page.getByRole("link", { name: /Choose a lab/ }).click();
  await expect(page.getByRole("heading", { name: "Run a lab" })).toBeVisible();
  for (const lab of [
    "Acid–base titration",
    "Solution preparation",
    "Dissolution calorimetry",
    "Gravimetric precipitation"
  ]) {
    await expect(page.getByRole("heading", { name: lab })).toBeVisible();
  }

  // The titration runs the capability-native runtime students actually get,
  // not the retired strangler rollback the demo used to pin.
  await page
    .getByRole("article")
    .filter({ hasText: "Acid–base titration" })
    .getByRole("link", { name: "Open lab" })
    .click();
  // The demo keeps the production pre-lab briefing rather than dropping an
  // evaluator straight onto the bench.
  await page.getByRole("button", { name: "Start the lab" }).click();
  await expect(page.getByText("3D bench ready", { exact: true })).toBeVisible({
    timeout: 60_000
  });
  await expect(page.locator("[data-workflow-id]").first()).toHaveAttribute(
    "data-workflow-id",
    "workflow.acid_base_titration.full.native.v2"
  );
  // A guest checkpoint must not surface as a failure in the demo.
  await expect(page.getByText("Save failed", { exact: false })).toHaveCount(0);

  await page.goto("/demo/teacher");
  await expect(
    page.getByRole("heading", { name: /Demo readiness/ })
  ).toBeVisible();

  await page.goto("/demo/composer");
  await expect(
    page.getByRole("heading", { name: "Build a student lab" })
  ).toBeVisible();

  for (const productionPath of ISOLATED_PRODUCTION_ENDPOINTS) {
    expect(
      requested,
      `${productionPath} must not be called from the demo area`
    ).not.toContain(productionPath);
  }
});

test("the demo navigation and reset stay inside the demo area", async ({
  page
}) => {
  await page.goto("/demo/labs");
  const nav = page.getByRole("navigation", { name: "Demo roles" });
  for (const label of ["Labs", "Teacher", "Composer"]) {
    await expect(nav.getByRole("link", { name: label })).toHaveAttribute(
      "href",
      /^\/demo/
    );
  }
  // The retired technical-trace inspector is gone from the tour.
  await expect(nav.getByRole("link", { name: "Technical" })).toHaveCount(0);

  await nav.getByRole("button", { name: /Reset demo/ }).click();
  await expect(page).toHaveURL(/\/demo$/);
});

test("retired demo routes no longer resolve", async ({ page }) => {
  for (const retired of ["/demo/student", "/demo/technical"]) {
    const response = await page.goto(retired);
    expect(response?.status(), retired).toBe(404);
  }
});
