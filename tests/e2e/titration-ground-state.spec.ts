import { expect, test } from "@playwright/test";

/**
 * A student demo must open onto a full procedure from a clean bench. The
 * default used to be the endpoint-control drill, which seeds 22 mL already
 * delivered, a conditioned burette, and the indicator already added — the
 * interesting steps done for you.
 */
test("titration opens on a ground-state bench", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/lab/titration");
  await expect(page.getByText("3D bench ready", { exact: true })).toBeVisible({
    timeout: 30_000
  });
  const scene = page.getByRole("region", { name: "Interactive lab bench" });

  await expect(scene).toHaveAttribute("data-burette-fill", "0.000");
  await expect(scene).toHaveAttribute("data-burette-conditioned", "false");
  await expect(scene).toHaveAttribute("data-indicator-added", "false");
  await expect(scene).toHaveAttribute(
    "data-procedure-stage",
    "prepare_burette"
  );
});

test("the endpoint drill is still reachable, and still starts mid-procedure", async ({
  page
}) => {
  test.setTimeout(120_000);
  await page.goto("/lab/titration?runtime=endpoint-drill");
  await expect(page.getByText("3D bench ready", { exact: true })).toBeVisible({
    timeout: 30_000
  });
  const scene = page.getByRole("region", { name: "Interactive lab bench" });

  await expect(scene).toHaveAttribute("data-indicator-added", "true");
  await expect(scene).toHaveAttribute("data-procedure-stage", "add_titrant");
});
