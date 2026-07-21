import { expect, test, type Page } from "@playwright/test";

import {
  openLabCoach,
  openPrecisionControls,
  startLab
} from "./labHelpers";

const eventually = expect.configure({ timeout: 20_000 });

function collectBrowserErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

test("report feedback preserves the session and launches a proven child retry", async ({
  page
}) => {
  test.setTimeout(60_000);
  const browserErrors = collectBrowserErrors(page);
  const parentSessionId = "11111111-1111-4111-8111-111111111134";
  await page.goto(
    `/lab/titration?retry=endpoint_control&parent=${parentSessionId}`
  );
  await eventually(
    page.getByText("3D bench ready", { exact: true })
  ).toBeVisible();
  await openPrecisionControls(page);
  await eventually(
    page.getByText("22.00 mL cumulative", { exact: true })
  ).toBeVisible();

  await page.getByLabel("Volume to add (mL)").fill("4");
  await page.getByLabel("Delivery time (seconds)").fill("1");
  await page.getByRole("button", { name: "Add titrant", exact: true }).click();
  await page.getByRole("button", { name: "Close precision controls" }).click();
  await eventually(
    page.getByRole("dialog", { name: "Lab coach" })
  ).toBeVisible();
  await eventually(
    page.getByText(/went past the target region/i)
  ).toBeVisible();
  await page.getByRole("button", { name: "Close lab coach" }).click();

  await page.getByRole("link", { name: "Open report" }).click();
  await eventually(
    page.getByRole("heading", { name: "Lab report" })
  ).toBeVisible();
  await page
    .getByLabel("Procedure summary")
    .fill("I conditioned and filled the burette, then delivered titrant.");
  await page
    .getByLabel("Data analysis")
    .fill(
      "The recorded volume and endpoint color show that I added too much titrant."
    );
  await page
    .getByLabel("Concept explanation")
    .fill(
      "The indicator changes near equivalence, so smaller controlled additions improve endpoint precision."
    );
  await page
    .getByLabel("Sources of error")
    .fill("A delivery rate that is too high can overshoot the endpoint.");
  await page.getByRole("button", { name: "Submit report" }).click();

  await eventually(
    page.getByRole("heading", { name: "Formative feedback" })
  ).toBeVisible();
  for (const dimension of [
    "Concept understanding",
    "Procedure",
    "Data analysis",
    "Significant figures"
  ]) {
    await eventually(
      page.getByRole("heading", { name: new RegExp(dimension) })
    ).toBeVisible();
  }
  await eventually(page.getByText("add_titrant").first()).toBeVisible();

  await page.getByRole("button", { name: "Review checkpoint retry" }).click();
  const retryDialog = page.getByRole("dialog", {
    name: "Reset to a focused checkpoint?"
  });
  await expect(retryDialog).toBeVisible();
  await expect(
    retryDialog.getByText(/Nothing resets automatically/)
  ).toBeVisible();
  await retryDialog.getByRole("button", { name: "Not now" }).click();
  await expect(retryDialog).toHaveCount(0);
  await expect(page).toHaveURL(/\/report/);

  await page.getByRole("button", { name: "Review checkpoint retry" }).click();
  await page
    .getByRole("dialog", { name: "Reset to a focused checkpoint?" })
    .getByRole("link", { name: "Start checkpoint retry" })
    .click();
  await eventually(page).toHaveURL(/retry=endpoint_control&parent=/);
  await eventually(
    page.getByText("3D bench ready", { exact: true })
  ).toBeVisible();
  await openPrecisionControls(page);
  await eventually(
    page.getByText("22.00 mL cumulative", { exact: true })
  ).toBeVisible();
  await eventually(page.getByText("Endpoint-control retry")).toBeVisible();

  await page.getByLabel("Volume to add (mL)").fill("2.5");
  await page.getByLabel("Delivery time (seconds)").fill("125");
  await page.getByRole("button", { name: "Add titrant", exact: true }).click();
  await eventually(
    page.getByText("Retry success recorded as new positive evidence.")
  ).toBeVisible();
  expect(browserErrors).toEqual([]);
});

test("hold-to-ask makes a transcript editable and sends it through the coach route", async ({
  page
}) => {
  const browserErrors = collectBrowserErrors(page);
  await page.addInitScript(() => {
    class FakeSpeechRecognition {
      continuous = false;
      interimResults = false;
      onresult: ((event: unknown) => void) | null = null;
      onerror: (() => void) | null = null;
      onend: (() => void) | null = null;

      start() {
        setTimeout(() => {
          this.onresult?.({
            results: [
              Object.assign([{ transcript: "Why should I slow down" }], {
                isFinal: true
              })
            ]
          });
        }, 0);
      }

      stop() {
        this.onend?.();
      }
    }

    Object.defineProperty(window, "SpeechRecognition", {
      configurable: true,
      value: FakeSpeechRecognition
    });
  });
  await page.goto("/lab/titration?seed=voice-transcript-e2e&runtime=setup-v2");
  await startLab(page);
  await openLabCoach(page);

  const holdButton = page.getByRole("button", { name: "Hold to Ask" });
  const question = page.getByLabel("Ask about this lab");
  await holdButton.hover();
  await page.mouse.down();
  await eventually(
    page.getByRole("button", { name: "Release to finish" })
  ).toBeVisible();
  await eventually(question).toHaveValue("Why should I slow down");
  await page.mouse.up();
  await eventually(page.getByText(/Transcript ready/)).toBeVisible();

  await question.fill("Why should I slow down near the endpoint?");
  await page.getByRole("button", { name: "Ask coach" }).click();
  await eventually(
    page.getByText(/You: Why should I slow down near the endpoint/)
  ).toBeVisible();
  await eventually(page.getByText(/Coach: Use the observation/)).toBeVisible();
  expect(browserErrors).toEqual([]);
});

test("microphone denial leaves the canonical text fallback operable", async ({
  page
}) => {
  const browserErrors = collectBrowserErrors(page);
  await page.addInitScript(() => {
    class DeniedSpeechRecognition {
      continuous = false;
      interimResults = false;
      onresult: ((event: unknown) => void) | null = null;
      onerror: (() => void) | null = null;
      onend: (() => void) | null = null;

      start() {
        setTimeout(() => this.onerror?.(), 0);
      }

      stop() {
        this.onend?.();
      }
    }

    Object.defineProperty(window, "SpeechRecognition", {
      configurable: true,
      value: DeniedSpeechRecognition
    });
  });
  await page.goto("/lab/titration?seed=voice-denial-e2e&runtime=setup-v2");
  await startLab(page);
  await openLabCoach(page);

  const holdButton = page.getByRole("button", { name: "Hold to Ask" });
  await holdButton.hover();
  await page.mouse.down();
  await eventually(
    page.getByText(/Microphone denied or unavailable/)
  ).toBeVisible();
  await page.mouse.up();

  const question = page.getByLabel("Ask about this lab");
  await question.fill("What observation should I record?");
  await page.getByRole("button", { name: "Ask coach" }).click();
  await eventually(
    page.getByText(/You: What observation should I record/)
  ).toBeVisible();
  await eventually(page.getByText(/Coach: Use the observation/)).toBeVisible();
  expect(browserErrors).toEqual([]);
});
