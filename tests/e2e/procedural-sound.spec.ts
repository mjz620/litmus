import { expect, test } from "@playwright/test";

test("procedural sound mute is accessible and persists for the session", async ({
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
  const soundOn = page.getByRole("button", { name: "Mute lab sounds" });
  await expect(soundOn).toHaveAttribute("aria-pressed", "false");
  await soundOn.click();

  const soundOff = page.getByRole("button", { name: "Unmute lab sounds" });
  await expect(soundOff).toHaveAttribute("aria-pressed", "true");
  await page.reload();
  await expect(page.getByText("3D bench ready", { exact: true })).toBeVisible({
    timeout: 30_000
  });
  await expect(
    page.getByRole("button", { name: "Unmute lab sounds" })
  ).toHaveAttribute("aria-pressed", "true");
  expect(browserErrors).toEqual([]);
});
