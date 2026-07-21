import { expect, test } from "@playwright/test";

/**
 * Reaching the endpoint must read as completion, not as a stall.
 *
 * The endpoint drill closes both its permitted actions once the endpoint rule
 * is satisfied, leaving no available control group. The bench previously fell
 * through to "continue titrating" while the valve refused, and the burette
 * hint blamed unfinished earlier steps — so a finished lab looked broken.
 */
test("the endpoint drill reports completion and points at the report", async ({
  page
}) => {
  test.setTimeout(180_000);
  /*
   * This guarantee belongs to the endpoint drill on the setup-driven runtime.
   * It used to be reached through /demo/student, which pinned that runtime;
   * the judge demo now runs the capability-native bench students actually use,
   * so the drill is exercised at its own route instead.
   */
  await page.goto("/lab/titration?runtime=setup-v2&drill");
  await expect(page.getByText("3D bench ready", { exact: true })).toBeVisible({
    timeout: 30_000
  });
  await page.waitForTimeout(2_000);

  await page.getByRole("button", { name: /Precision controls/ }).click();
  await page.getByRole("button", { name: "Record meniscus reading" }).click();
  await page.waitForTimeout(800);

  for (let step = 0; step < 30; step += 1) {
    const add = page
      .getByRole("button", { name: /Add titrant|Dispense/ })
      .first();
    if ((await add.count()) === 0) break;
    await add.click();
    await page.waitForTimeout(200);
  }

  const prompt = page
    .locator("p")
    .filter({ hasText: /Endpoint reached|Continue titrating/ })
    .first();
  await expect(prompt).toContainText("Endpoint reached");
  await expect(prompt).toContainText("Open the report");

  // The exit it names must actually exist.
  await expect(page.getByRole("link", { name: /Open report/ })).toBeVisible();
});
