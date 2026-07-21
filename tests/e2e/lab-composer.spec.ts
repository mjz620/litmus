import { expect, test, type Locator, type Page } from "@playwright/test";

import { serializeLabDraft } from "../../src/lab-workflows/authoring";
import { NATIVE_TITRATION_V2_DRAFT } from "../../src/lab-workflows/definitions/titration/native-endpoint-control";
import { LOCAL_LAB_DRAFT_KEY_PREFIX } from "../../src/components/teacher/lab-composer/localRepository";

async function pointerDrag(
  page: Page,
  source: Locator,
  target: Locator,
  expectOver = true
) {
  await source.scrollIntoViewIfNeeded();
  await target.scrollIntoViewIfNeeded();
  await expect(source).toBeInViewport();
  await expect(target).toBeInViewport();
  const sourceBox = await source.boundingBox();
  const targetBox = await target.boundingBox();
  if (!sourceBox || !targetBox) throw new Error("Drag target is not visible.");
  const start = {
    x: sourceBox.x + sourceBox.width / 2,
    y: sourceBox.y + sourceBox.height / 2
  };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + 10, start.y, { steps: 3 });
  await page.waitForTimeout(150);
  await expect(page.locator("[data-active-drag]")).not.toHaveAttribute(
    "data-active-drag",
    ""
  );
  const overlay = page.getByTestId("composer-drag-overlay");
  await expect(overlay).toBeVisible();
  const overlayStart = await overlay.boundingBox();
  const currentTargetBox = await target.boundingBox();
  if (!currentTargetBox) throw new Error("Drop target moved out of view.");
  let finish = {
    x: currentTargetBox.x + currentTargetBox.width / 2,
    y: currentTargetBox.y + currentTargetBox.height / 2
  };
  await page.mouse.move(finish.x, finish.y, { steps: 12 });
  await page.waitForTimeout(150);
  const overlayFinish = await overlay.boundingBox();
  if (!overlayStart || !overlayFinish)
    throw new Error("The dragged item did not remain visible.");
  expect(
    Math.abs(overlayFinish.x - overlayStart.x) +
      Math.abs(overlayFinish.y - overlayStart.y)
  ).toBeGreaterThan(20);
  // Dnd Kit can auto-scroll a long page while the pointer crosses panels. Follow
  // the live target rect so the release still represents a real pointer drop.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const liveTargetBox = await target.boundingBox();
    if (!liveTargetBox) throw new Error("Drop target moved out of view.");
    finish = {
      x: liveTargetBox.x + liveTargetBox.width / 2,
      y: liveTargetBox.y + liveTargetBox.height / 2
    };
    await page.mouse.move(finish.x, finish.y, { steps: 4 });
    await page.waitForTimeout(100);
    if (
      (await target.getAttribute("data-over")) ===
      (expectOver ? "true" : "false")
    )
      break;
  }
  if ((await target.getAttribute("data-over")) !== null) {
    await expect(target).toHaveAttribute(
      "data-over",
      expectOver ? "true" : "false"
    );
  }
  await page.mouse.up();
  await page.waitForTimeout(250);
}

function revisionMarker(page: Page): Locator {
  return page.locator("[data-draft-revision]");
}

function nonRunnableAgentProposal(
  outcome: "unsupported" | "rejected_for_safety" | "limited"
) {
  const copy = {
    unsupported: {
      objective: "Build an aspirin synthesis lab.",
      limitations: ["The available equipment does not support this lab yet."]
    },
    rejected_for_safety: {
      objective: "Build an open-flame test.",
      limitations: [
        "This request cannot be offered with the current safety controls."
      ]
    },
    limited: {
      objective: "Build a supported lab with too many requested variations.",
      limitations: [
        "The bounded draft pass ended before a safe draft was ready."
      ]
    }
  }[outcome];
  return {
    ok: true,
    metadata: {
      contractVersion: "2.0.0",
      promptVersion: "lab-author-capability-v1",
      toolContractVersion: "lab-author-capability-tools-v1",
      outputSchemaVersion: "2.0.0",
      model: "deterministic-capability-author",
      mode: "mock",
      registrySnapshotIds: {},
      limits: {
        maxRevisionAttempts: 3,
        maxModelCalls: 9,
        maxToolCalls: 24,
        maxOutputTokensPerCall: 6_000,
        timeoutMs: 55_000
      },
      usage: {
        modelCalls: 1,
        toolCalls: 0,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        estimatedCost: {
          currency: "USD",
          amount: 0,
          source: "deterministic_mock"
        }
      },
      hashLineage: [],
      toolAudit: []
    },
    result: {
      outcome,
      objective: copy.objective,
      assumptions: ["Only registered Litmus equipment may be used."],
      questions: [],
      limitations: copy.limitations,
      workflow: null,
      validation: null,
      traces: [],
      unresolvedDiagnostics: []
    }
  };
}

async function expectRevision(page: Page, revision: number) {
  await expect(revisionMarker(page)).toHaveAttribute(
    "data-draft-revision",
    String(revision)
  );
}

test("AI review tab explains an empty bounded loop without internal details (LC2-704)", async ({
  page
}) => {
  await page.goto("/teacher/lab-composer");
  await page.getByRole("button", { name: /^AI review/ }).click();

  await expect(
    page.getByRole("heading", { name: "See the AI review loop" })
  ).toBeVisible();
  await expect(page.getByText("No draft suggestion yet")).toBeVisible();
  await expect(
    page.getByText("Lab checker has not run on this version")
  ).toBeVisible();
  await expect(page.getByText("No teaching review yet")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Open draft helper" })
  ).toBeVisible();
  await expect(page.locator("body")).not.toContainText(
    /chain of thought|draft hash|sha256:|registry id|tool argument/i
  );

  await page.getByRole("button", { name: "Open draft helper" }).press("Enter");
  await expect(
    page.getByRole("heading", { name: "Describe the lab you want" })
  ).toBeVisible();
});

test("teacher composes setup and workflow through bounded registered controls", async ({
  page
}) => {
  /*
   * The composer is deliberately usable signed out — local drafts and preview
   * need no account — so the cloud endpoints answer 401 for a guest. That is
   * correct behaviour, not a composer fault, and it must not be read as a
   * browser error by the zero-error assertions below.
   */
  for (const cloudRoute of [
    "**/api/teacher/classes",
    "**/api/lab-composer/definitions/drafts"
  ]) {
    await page.route(cloudRoute, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ items: [] })
      });
    });
  }
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
    page.getByRole("heading", { name: "Build a student lab" })
  ).toBeVisible();
  await expect(page.getByText("Needs checking")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Preview", exact: true })
  ).toBeDisabled();
  await expect(page.getByRole("button", { name: "Assign" })).toBeDisabled();
  const initialRevision = await revisionMarker(page).getAttribute(
    "data-draft-revision"
  );
  await page.getByRole("button", { name: /^Set up/ }).click();
  await expect(page.getByTestId("composer-3d-bench")).toBeVisible();
  await page.getByRole("button", { name: "Accessible list" }).click();
  await expect(revisionMarker(page)).toHaveAttribute(
    "data-draft-revision",
    initialRevision ?? ""
  );
  const reagentCard = page
    .getByRole("article")
    .filter({ hasText: "Reagent bottle" });
  await reagentCard.getByRole("button", { name: "Add" }).click();
  await page.waitForTimeout(250);
  expect(browserErrors).toEqual([]);
  await expect(page.getByLabel("Equipment to edit")).toHaveValue(
    /teacher\.component_reagent_bottle_v1\./
  );
  await expect(page.getByText("Technical details")).toHaveCount(0);
  await expect(page.getByText("visual-adapter.reagent_bottle.v1")).toHaveCount(
    0
  );

  await page
    .getByRole("combobox", { name: "Material", exact: true })
    .selectOption("reagent.distilled_water.v1");
  // Reagents are paired with an explicit empty container: choose the reagent
  // bottle just added before adding the material (no silent auto-pick).
  await page
    .getByRole("combobox", { name: "Put it in" })
    .selectOption({ label: "Reagent bottle" });
  await page.getByRole("button", { name: "Add material" }).click();
  await expectRevision(page, 3);
  await expect(
    page
      .getByRole("button", {
        name: /Preparation supplies on the right.*Reagent bottle/
      })
      .locator("..")
  ).toHaveAttribute("data-occupied", "true");

  await page.getByLabel("Equipment to edit").selectOption("titrant_burette");
  await page.getByRole("button", { name: "Remove equipment" }).click();
  const removalDialog = page.getByRole("dialog", {
    name: "Remove Titrant burette?"
  });
  await expect(removalDialog).toBeVisible();
  await expect(
    removalDialog.getByText("Preview will be unavailable")
  ).toBeVisible();
  await removalDialog.getByLabel(/I understand that the related items/).check();
  await removalDialog
    .getByRole("button", { name: "Remove", exact: true })
    .click();
  await expect(removalDialog).toHaveCount(0);
  await expect(page.getByText("Needs checking")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Preview", exact: true })
  ).toBeDisabled();
  await expect(
    page
      .getByLabel("Equipment to edit")
      .locator('option[value="titrant_burette"]')
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(
    page
      .getByLabel("Equipment to edit")
      .locator('option[value="titrant_burette"]')
  ).toHaveCount(1);

  await page.getByRole("button", { name: /^Workflow/ }).click();
  await expect(
    page.getByRole("heading", { name: "Show what happens first" })
  ).toBeVisible();

  await page.getByLabel("How is it used?").selectOption("best_practice");
  await page.getByRole("button", { name: "Add student action" }).click();
  await expect(page.locator('[data-role="best-practice"]')).toBeVisible();

  await page.getByLabel("What should the lab check?").selectOption("tolerance");
  await page.getByLabel("Lowest value").fill("24.98");
  await page
    .getByRole("spinbutton", { name: "Highest value", exact: true })
    .fill("25.02");
  await page.getByRole("button", { name: "Add result range" }).click();
  await expect(
    page
      .getByRole("strong")
      .filter({ hasText: "Burette Reading Ml from 24.98 to 25.02" })
  ).toBeVisible();

  await page.getByLabel("Title").fill("Observe the endpoint");
  await page
    .getByLabel("Guidance")
    .fill("Use the registered indicator response as evidence.");
  await page.getByRole("button", { name: "Add direction" }).click();
  await expect(page.getByText("Observe the endpoint")).toBeVisible();

  await page.getByRole("button", { name: /^Assess/ }).click();
  await page.getByRole("button", { name: "New grading item" }).click();
  await page.getByLabel("Description").fill("Documents endpoint evidence");
  await page.getByRole("button", { name: "Add grading item" }).click();
  await expect(page.getByText("Documents endpoint evidence")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Preview", exact: true })
  ).toBeDisabled();
  expect(browserErrors).toEqual([]);
});

test("New grading item always lands the teacher on the grading item form", async ({
  page
}) => {
  /*
   * The editor sits below the three relationship columns, and with no grading
   * items yet it already renders in add mode — so toggling the flag changed
   * nothing on screen and the button read as broken. Every click must move
   * focus to the form, including a repeat click that leaves the flag set.
   */
  await page.goto("/teacher/lab-composer");
  await page.getByRole("button", { name: /^Assess/ }).click();
  await expect(
    page.getByRole("heading", { name: "Connect goals, grading, and evidence" })
  ).toBeVisible();

  const editor = page.getByRole("complementary", {
    name: "Grading item editor"
  });
  const description = editor.getByLabel("Description");
  const newItem = page.getByRole("button", { name: "New grading item" });

  await expect(description).not.toBeFocused();

  await newItem.click();
  await expect(editor.locator("header p")).toHaveText("Add grading item");
  await expect(description).toBeFocused();
  await expect(description).toBeInViewport();

  // Move focus away, then click again: the flag is already set, so this is the
  // exact case that used to render identically and do nothing.
  await page.getByRole("button", { name: /^Assess/ }).focus();
  await expect(description).not.toBeFocused();
  await newItem.click();
  await expect(description).toBeFocused();
});

test("composer remains keyboard reachable without horizontal overflow on a student Chromebook viewport", async ({
  page
}) => {
  await page.setViewportSize({ width: 768, height: 900 });
  await page.goto("/teacher/lab-composer");
  const assessStage = page.getByRole("button", {
    name: /^Assess/
  });
  await expect(page.getByText("Needs checking")).toBeVisible();
  await assessStage.focus();
  await assessStage.press("Space");
  await expect(
    page.getByRole("heading", { name: "Connect goals, grading, and evidence" })
  ).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth)
  ).toBeLessThanOrEqual(768);
});

test("capability-authored proposal loads into the shared editor and becomes stale after a teacher edit (LC2-602)", async ({
  page
}) => {
  test.setTimeout(60_000);
  const browserErrors: string[] = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  await page.goto("/teacher/lab-composer");

  await page
    .getByLabel("Lab description")
    .fill(
      "Create a sodium chloride dilution using a volumetric pipette and flask."
    );
  await page.getByRole("button", { name: "Create draft proposal" }).click();
  await expect(page.getByText("Ready for your review")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "What this draft assumes" })
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "What the simulator verified" })
  ).toBeVisible();
  await expect(page.getByText("5 of 5 passed")).toBeVisible();
  await expect(
    page.getByText("Flexible equipment-and-action simulation")
  ).toBeVisible();
  await page.getByText("Generation details").click();
  await expect(page.getByText("Deterministic local fallback")).toBeVisible();
  await expect(page.getByText("lab-author-capability-v1")).toBeVisible();
  await expect(page.locator("body")).not.toContainText(
    /chain of thought|draft hash|sha256:/i
  );

  await page.getByRole("button", { name: "Use this draft" }).click();
  await expect(page.getByLabel("Lab title")).toHaveValue(
    "Prepare a sodium chloride dilution"
  );
  await expect(page.getByText("Ready to preview")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Preview", exact: true })
  ).toBeEnabled();
  await expect(page.getByRole("button", { name: "Assign" })).toBeDisabled();

  await page.getByLabel("Lab title").fill("Teacher-edited dilution");
  await page.getByRole("button", { name: "Save definition" }).click();
  await expect(page.getByText("Out of date after editing")).toBeVisible();
  await expect(page.getByText("Needs checking")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Preview", exact: true })
  ).toBeDisabled();

  await page.getByRole("button", { name: "Check edited draft" }).click();
  await expect(page.getByText("Ready to preview")).toBeVisible();
  await expect(page.getByText("Out of date after editing")).toBeVisible();
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await expect(page).toHaveURL(/\/teacher\/lab-composer\/preview\?hash=/);
  await expect(page.getByTestId("setup-driven-student-bench")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Teacher-edited dilution" })
  ).toBeVisible();
  expect(browserErrors).toEqual([]);
});

test("capability author shows streamed procedural progress without private reasoning (LC2-603)", async ({
  page
}) => {
  const proposal = nonRunnableAgentProposal("unsupported");
  await page.addInitScript((finalProposal) => {
    const originalFetch = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;
      if (!url.endsWith("/api/lab-composer/author/capability")) {
        return originalFetch(input, init);
      }

      const encoder = new TextEncoder();
      const events = [
        {
          type: "progress",
          progress: {
            stage: "understanding_request",
            message: "Reading your request and identifying the learning goal."
          }
        },
        {
          type: "progress",
          progress: {
            stage: "checking_available_parts",
            message:
              "Checking which equipment, materials, and actions are available."
          }
        },
        {
          type: "progress",
          progress: {
            stage: "using_verified_fallback",
            message:
              "The live helper could not finish, so Litmus is using its verified local builder."
          }
        },
        { type: "result", result: finalProposal }
      ];
      return new Response(
        new ReadableStream({
          start(controller) {
            let index = 0;
            const send = () => {
              controller.enqueue(
                encoder.encode(`${JSON.stringify(events[index])}\n`)
              );
              index += 1;
              if (index === events.length) {
                controller.close();
                return;
              }
              window.setTimeout(send, 600);
            };
            send();
          }
        }),
        { headers: { "content-type": "application/x-ndjson" } }
      );
    };
  }, proposal);

  await page.goto("/teacher/lab-composer");
  await page
    .getByLabel("Lab description")
    .fill("Create a beginner dilution lab.");
  await page.getByRole("button", { name: "Create draft proposal" }).click();

  await expect(
    page.getByRole("heading", { name: "Building your lab" })
  ).toBeVisible();
  await expect(page.getByText("Understand the request")).toHaveAttribute(
    "data-state",
    "current"
  );
  await expect(page.getByText("Check available lab parts")).toHaveAttribute(
    "data-state",
    "current"
  );
  await expect(page.getByText("Build the draft")).toHaveAttribute(
    "data-state",
    "upcoming"
  );
  await expect(page.getByText(/not private model thoughts/i)).toBeVisible();
  await expect(
    page.getByText(/continued with its verified local builder/i)
  ).toBeVisible();
  await expect(
    page.getByText("Not supported by the available lab tools")
  ).toBeVisible();
  await expect(page.locator("body")).not.toContainText(
    /chain of thought|draft hash|registry id|tool argument/i
  );
});

test("optional teaching review stays separate from validation and becomes stale after editing (LC2-702)", async ({
  page
}) => {
  test.setTimeout(60_000);
  await page.setExtraHTTPHeaders({ "x-forwarded-for": "lc2-702-stale" });
  await page.setViewportSize({ width: 768, height: 1000 });
  await page.goto("/teacher/lab-composer");
  await page.getByLabel("Duration in minutes").fill("12");
  await page.getByRole("button", { name: "Save definition" }).click();
  await page
    .getByLabel("Lab description")
    .fill(
      "Create a sodium chloride dilution using a volumetric pipette and flask."
    );
  await page.getByRole("button", { name: "Create draft proposal" }).click();
  await page.getByRole("button", { name: "Use this draft" }).click();
  await page.getByRole("button", { name: /^Check & preview/ }).click();

  await expect(page.getByText("Ready to preview")).toBeVisible();
  await expect(
    page.getByText(/only the Litmus checker can do that/i)
  ).toBeVisible();
  const reviewButton = page.getByRole("button", {
    name: "Run teaching review"
  });
  await reviewButton.focus();
  await reviewButton.press("Enter");
  await expect(page.getByText("Teaching review looks good")).toBeVisible();
  await expect(page.getByText(/4\.[5-9] \/ 5/)).toBeVisible();
  await expect(
    page.getByText("The current version passed the optional teaching review.")
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Preview", exact: true })
  ).toBeEnabled();
  await expect(page.getByRole("button", { name: "Assign" })).toBeDisabled();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth)
  ).toBeLessThanOrEqual(768);
  await expect(page.locator("body")).not.toContainText(
    /sha256:|draft hash|\$\.rubric/i
  );

  await page.getByRole("button", { name: /^Define/ }).click();
  await page.getByLabel("Lab title").fill("Edited after teaching review");
  await page.getByRole("button", { name: "Save definition" }).click();
  await page.getByRole("button", { name: /^Check & preview/ }).click();
  await expect(page.getByText("Out of date", { exact: true })).toBeVisible();
  await expect(
    page.getByText(/draft changed after this review/i)
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Run a fresh teaching review" })
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Preview", exact: true })
  ).toBeDisabled();
});

test("teacher-accepted Judge suggestion uses commands, rechecks, retraces, and rejudges (LC2-702)", async ({
  page
}) => {
  test.setTimeout(60_000);
  await page.setExtraHTTPHeaders({ "x-forwarded-for": "lc2-702-revision" });
  await page.goto("/teacher/lab-composer");
  await page.getByLabel("Duration in minutes").fill("12");
  await page.getByRole("button", { name: "Save definition" }).click();
  await page
    .getByLabel("Lab description")
    .fill(
      "Create a sodium chloride dilution using a volumetric pipette and flask."
    );
  await page.getByRole("button", { name: "Create draft proposal" }).click();
  await page.getByRole("button", { name: "Use this draft" }).click();

  await page.getByRole("button", { name: /^Assess/ }).click();
  const points = page.getByRole("spinbutton", { name: "Maximum points" });
  await points.fill("9");
  await page.getByRole("button", { name: "Save grading item" }).click();
  await page
    .getByRole("button", { name: /^Solution Dilution/ })
    .first()
    .click();
  await points.fill("1");
  await page.getByRole("button", { name: "Save grading item" }).click();

  await page.getByRole("button", { name: /^Check & preview/ }).click();
  await page
    .getByRole("button", { name: "Check lab", exact: true })
    .last()
    .click();
  await expect(page.getByText("Ready to preview")).toBeVisible();
  await page.getByRole("button", { name: "Run teaching review" }).click();
  await expect(
    page.getByText("Teaching review suggests changes")
  ).toBeVisible();
  await expect(
    page.getByText("Balance rubric points across the objectives")
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Apply, check, and review again" })
    .click();
  await expect(page.getByText("Teaching review looks good")).toBeVisible();
  await expect(
    page.getByText("The revised version passed the optional teaching review.")
  ).toBeVisible();
  await expect(
    page.getByText(/accepted teaching suggestion passed the lab checker/i)
  ).toBeVisible();
  await page.getByText(/Teaching review history/).click();
  await expect(
    page.getByText(/Teacher accepted: Balance rubric points/i)
  ).toBeVisible();
  await page.getByRole("button", { name: /^AI review/ }).click();
  await expect(
    page.getByRole("heading", { name: "See the AI review loop" })
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Who decides what" })
  ).toBeVisible();
  await expect(page.getByText("Lab checker passed")).toBeVisible();
  await expect(
    page.getByText(
      "Teacher accepted: Balance rubric points across the objectives"
    )
  ).toBeVisible();
  await expect(
    page.getByText("The revised version passed the optional teaching review.")
  ).toBeVisible();
  await expect(page.locator("body")).not.toContainText(
    /chain of thought|draft hash|sha256:|registry id|tool argument/i
  );
  await expect(
    page.getByRole("button", { name: "Preview", exact: true })
  ).toBeEnabled();
  await expect(page.getByRole("button", { name: "Assign" })).toBeDisabled();
});

test("unsupported, unsafe, and budget-limited proposals stay non-runnable and keyboard reachable (LC2-602)", async ({
  page
}) => {
  await page.setViewportSize({ width: 768, height: 900 });
  await page.route("**/api/lab-composer/author/capability", async (route) => {
    const request = JSON.parse(route.request().postData() ?? "{}") as {
      teacherRequest?: string;
    };
    const outcome = request.teacherRequest?.includes("flame")
      ? "rejected_for_safety"
      : request.teacherRequest?.includes("variations")
        ? "limited"
        : "unsupported";
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(nonRunnableAgentProposal(outcome))
    });
  });
  await page.goto("/teacher/lab-composer");

  for (const [request, label] of [
    [
      "Create an aspirin synthesis lab.",
      "Not supported by the available lab tools"
    ],
    ["Create an open flame test.", "Cannot be built safely"],
    [
      "Create a supported lab with too many requested variations.",
      "Could not finish within the safe limits"
    ]
  ] as const) {
    await page.getByLabel("Lab description").fill(request);
    const generate = page.getByRole("button", {
      name: /Create draft proposal|Try revised description/
    });
    await generate.focus();
    await generate.press("Enter");
    await expect(page.getByText(label)).toBeVisible();
    await expect(
      page.getByText("Only registered Litmus equipment may be used.")
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Use this draft" })
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Preview", exact: true })
    ).toBeDisabled();
    await page.getByRole("button", { name: "Reject proposal" }).click();
  }

  expect(
    await page.evaluate(() => document.documentElement.scrollWidth)
  ).toBeLessThanOrEqual(768);
});

test("manual typing and checkbox editing never open the application error page", async ({
  page
}) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto("/teacher/lab-composer");

  await page.getByLabel("Lab title").click();
  await page.getByLabel("Lab title").pressSequentially(" updated");
  await page.getByLabel("Student summary").click();
  await page.getByLabel("Student summary").pressSequentially(" More practice.");
  await page.getByLabel("Learning objective summary").click();
  await page
    .getByLabel("Learning objective summary")
    .pressSequentially(" Explain the reading.");
  await page.getByLabel("Grade band").selectOption("9-10");
  await page.getByLabel("Duration in minutes").fill("12");

  await page.getByRole("button", { name: /^Assess/ }).click();
  await page.waitForTimeout(250);
  expect(pageErrors).toEqual([]);
  const evidenceChoice = page
    .getByRole("group", { name: "Evidence to use" })
    .getByRole("checkbox")
    .first();
  await evidenceChoice.click();
  await evidenceChoice.click();

  await expect(page.getByText("Application error")).toHaveCount(0);
  expect(pageErrors).toEqual([]);
});

test("setup pointer drops are atomic and canceled or incompatible drops do not mutate", async ({
  page
}) => {
  await page.setViewportSize({ width: 1366, height: 2000 });
  await page.goto("/teacher/lab-composer");
  await page.getByRole("button", { name: /^Set up/ }).click();
  await page.getByRole("button", { name: "Accessible list" }).click();
  const reagentDrag = page.getByRole("button", {
    name: "Drag Reagent bottle to a compatible slot"
  });
  const reagentSlot = page.getByRole("button", {
    name: /^Preparation supplies on the right/
  });
  await pointerDrag(page, reagentDrag, reagentSlot.locator(".."));
  await expectRevision(page, 2);
  await expect(reagentSlot).toHaveAccessibleName(/Reagent bottle/);

  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expectRevision(page, 3);
  await expect(reagentSlot).toHaveAccessibleName(/Empty position/);

  await pointerDrag(page, reagentDrag, reagentDrag.locator(".."));
  await expectRevision(page, 3);
  await pointerDrag(
    page,
    reagentDrag,
    page
      .getByRole("button", { name: /^Center dispensing station:/ })
      .locator(".."),
    false
  );
  await expectRevision(page, 3);

  const reagentCard = page
    .getByRole("article")
    .filter({ hasText: "Reagent bottle" });
  await reagentCard.getByRole("button", { name: "Add" }).click();
  await expectRevision(page, 4);
  await page
    .getByRole("combobox", { name: "Material", exact: true })
    .selectOption("reagent.distilled_water.v1");
  await page
    .getByRole("combobox", { name: "Put it in", exact: true })
    .selectOption({ label: "Reagent bottle" });
  await page.getByRole("button", { name: "Add material" }).click();
  await expectRevision(page, 5);
  await expect(
    page
      .getByRole("list", { name: "Bound materials" })
      .getByText("Distilled water")
  ).toBeVisible();
});

test("registered material chips bind to compatible containers by pointer", async ({
  page
}) => {
  await page.setViewportSize({ width: 1366, height: 2000 });
  await page.goto("/teacher/lab-composer");
  await page.getByRole("button", { name: /^Set up/ }).click();
  await page.getByRole("button", { name: "Accessible list" }).click();
  await page
    .getByRole("article")
    .filter({ hasText: "Reagent bottle" })
    .getByRole("button", { name: "Add" })
    .click();
  await pointerDrag(
    page,
    page.getByRole("button", {
      name: "Drag Distilled water to a compatible container"
    }),
    page
      .getByRole("button", { name: /^Preparation supplies on the right/ })
      .locator("..")
  );
  await expectRevision(page, 3);
  await expect(
    page
      .getByRole("list", { name: "Bound materials" })
      .getByText("Distilled water")
  ).toBeVisible();
});

test("teacher authors a bounded stock concentration with plain-language feedback", async ({
  page
}) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto("/teacher/lab-composer");
  await page.getByRole("button", { name: /^Set up/ }).click();
  await page
    .getByRole("article")
    .filter({ hasText: "Reagent bottle" })
    .getByRole("button", { name: "Add" })
    .click();
  await page
    .getByRole("combobox", { name: "Material", exact: true })
    .selectOption("reagent.sodium_chloride_aqueous.v1");
  await page
    .getByRole("combobox", { name: "Put it in", exact: true })
    .selectOption({ label: "Reagent bottle" });
  await page.getByRole("button", { name: "Add material" }).click();

  const concentration = page.getByLabel("Stock concentration");
  await expect(concentration).toBeVisible();
  await expect(page.getByText(/Allowed range: 0.1 to 1 mol\/L/)).toBeVisible();
  await concentration.fill("0.2500");
  await expect(
    page.getByText("This will be saved as 0.25 mol/L.")
  ).toBeVisible();
  await page.getByRole("button", { name: "Set concentration" }).click();
  await expect(concentration).toHaveValue("0.25");
  await expect(page.getByText("Needs checking")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Preview", exact: true })
  ).toBeDisabled();

  const revision = await revisionMarker(page).getAttribute(
    "data-draft-revision"
  );
  await concentration.fill("1e-1");
  await expect(
    page.getByText(
      /ordinary decimal notation without signs, commas, or exponents/i
    )
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Update concentration" })
  ).toBeDisabled();
  await expect(revisionMarker(page)).toHaveAttribute(
    "data-draft-revision",
    revision ?? ""
  );
  expect(pageErrors).toEqual([]);
});

test("verified 3D arrangement moves linked apparatus in one undo step", async ({
  page
}) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto("/teacher/lab-composer");
  await page.getByRole("button", { name: /^Set up/ }).click();
  await expect(page.getByTestId("composer-3d-bench")).toBeVisible();

  const equipment = page.getByLabel("Equipment to edit");
  const destination = page.getByLabel("Move equipment to");
  await equipment.selectOption("indicator_source");
  await destination.selectOption("placement.indicator_shelf_right.v1");
  await expectRevision(page, 2);

  const bench = page.getByTestId("composer-3d-bench");
  await bench.scrollIntoViewIfNeeded();
  await expect(bench).toHaveAttribute("data-render-ready", "true");
  await page.waitForTimeout(250);
  const benchBox = await bench.boundingBox();
  if (!benchBox) throw new Error("The 3D bench is not visible.");
  await page.mouse.move(
    benchBox.x + benchBox.width * 0.58,
    benchBox.y + benchBox.height * 0.29
  );
  await page.mouse.down();
  await page.mouse.move(
    benchBox.x + benchBox.width * 0.42,
    benchBox.y + benchBox.height * 0.29,
    { steps: 20 }
  );
  await page.mouse.up();
  await expectRevision(page, 3);
  await expect(bench.locator("..").getByRole("status")).toContainText(
    "Arrangement updated"
  );

  await page.getByRole("button", { name: "Accessible list" }).click();
  await expect(
    page.getByRole("button", {
      name: /Left dispensing station.*Titrant burette/
    })
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: /Flask beneath left burette.*Analyte flask/
    })
  ).toBeVisible();

  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expectRevision(page, 4);
  await expect(
    page.getByRole("button", {
      name: /Center dispensing station.*Titrant burette/
    })
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: /Flask beneath center burette.*Analyte flask/
    })
  ).toBeVisible();

  await page.getByRole("button", { name: "Reset arrangement" }).click();
  await expectRevision(page, 5);
  await expect(
    page.getByRole("button", {
      name: /Indicator shelf on the left.*Phenolphthalein/
    })
  ).toBeVisible();
});

test("Define objective removal reassigns references and restores dialog focus", async ({
  page
}) => {
  await page.goto("/teacher/lab-composer");
  const meniscus = page.getByRole("checkbox", { name: /^Meniscus Reading/i });
  await expect(meniscus).toBeChecked();

  await meniscus.click();
  const dialog = page.getByRole("dialog", { name: /Remove meniscus reading/i });
  await expect(dialog).toBeVisible();
  await expect(dialog).not.toContainText(
    /rubric\.criteria|objectiveIds|sha256:/i
  );
  const dialogBox = await dialog.boundingBox();
  const dialogHeadingBox = await dialog
    .getByRole("heading", { name: /Remove meniscus reading/i })
    .boundingBox();
  if (!dialogBox || !dialogHeadingBox)
    throw new Error("Removal dialog is not visible.");
  expect(dialogHeadingBox.x - dialogBox.x).toBeGreaterThanOrEqual(20);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(meniscus).toBeFocused();
  await expect(meniscus).toBeChecked();

  await meniscus.click();
  await page
    .getByRole("dialog", { name: /Remove meniscus reading/i })
    .getByRole("button", { name: "Move items and remove" })
    .click();
  await expect(meniscus).not.toBeChecked();
  await expect(page.getByText("Needs checking")).toBeVisible();
});

test("workflow Graph and Outline share exact ordering commands", async ({
  page
}) => {
  await page.goto("/teacher/lab-composer");
  await page.getByRole("button", { name: /^Workflow/ }).click();
  const connectionControls = page.getByRole("group", {
    name: "Connect two cards"
  });
  const predecessor = connectionControls.getByRole("combobox").nth(0);
  const successor = connectionControls.getByRole("combobox").nth(1);
  await predecessor.selectOption({ index: 0 });
  await successor.selectOption({ index: 1 });

  await page.getByRole("button", { name: "Connect cards" }).click();
  await expectRevision(page, 2);
  await page.getByRole("button", { name: "Connect cards" }).click();
  await expectRevision(page, 2);
  await expect(
    page.getByRole("alert").filter({ hasText: "cannot be added" })
  ).toContainText("cannot be added");

  await predecessor.selectOption({ index: 1 });
  await successor.selectOption({ index: 0 });
  await page.getByRole("button", { name: "Connect cards" }).click();
  await expectRevision(page, 2);

  await page.getByRole("tab", { name: "List" }).click();
  await expect(
    page.getByRole("heading", { name: "Must happen before" })
  ).toBeVisible();
  await page.getByRole("button", { name: "Remove relationship" }).click();
  await expectRevision(page, 3);
  await expect(
    page.getByText("No prerequisite", { exact: true }).first()
  ).toBeVisible();

  await predecessor.selectOption({ index: 0 });
  await successor.selectOption({ index: 0 });
  await page.getByRole("button", { name: "Connect cards" }).click();
  await expectRevision(page, 3);

  await page.getByRole("tab", { name: "Map" }).click();
  await expect(page.getByRole("button", { name: "Zoom in" })).toContainText(
    "+"
  );
  await expect(page.getByRole("button", { name: "Zoom out" })).toContainText(
    "−"
  );
  await expect(
    page.getByRole("button", { name: "Fit all cards in view" })
  ).toContainText("⊡");

  const firstNode = page.locator(".react-flow__node").first();
  const nodeBefore = await firstNode.boundingBox();
  if (!nodeBefore) throw new Error("Workflow card is not visible.");
  await page.mouse.move(
    nodeBefore.x + nodeBefore.width / 2,
    nodeBefore.y + nodeBefore.height / 2
  );
  await page.mouse.down();
  await page.mouse.move(
    nodeBefore.x + nodeBefore.width / 2 + 100,
    nodeBefore.y + nodeBefore.height / 2 + 40,
    { steps: 10 }
  );
  await page.mouse.up();
  const nodeAfter = await firstNode.boundingBox();
  if (!nodeAfter) throw new Error("Workflow card disappeared after dragging.");
  expect(Math.abs(nodeAfter.x - nodeBefore.x)).toBeGreaterThan(40);
  await expectRevision(page, 3);

  const nodes = page.locator(".react-flow__node");
  const sourceHandle = nodes.nth(0).locator(".react-flow__handle-right");
  const targetHandle = nodes.nth(1).locator(".react-flow__handle-left");
  const sourceBox = await sourceHandle.boundingBox();
  const targetBox = await targetHandle.boundingBox();
  if (!sourceBox || !targetBox)
    throw new Error("Workflow connectors are not visible.");
  await page.mouse.move(
    sourceBox.x + sourceBox.width / 2,
    sourceBox.y + sourceBox.height / 2
  );
  await page.mouse.down();
  await page.mouse.move(
    targetBox.x + targetBox.width / 2,
    targetBox.y + targetBox.height / 2,
    { steps: 15 }
  );
  await page.mouse.up();
  await expectRevision(page, 4);
  await expect(page.locator(".react-flow__edge")).toHaveCount(1);

  const inspector = page.getByRole("complementary", {
    name: "Selected rule inspector"
  });
  await inspector.getByLabel("Feedback type").selectOption("safety");
  await inspector.getByRole("button", { name: "Save rule" }).click();
  await expectRevision(page, 5);
  await expect(nodes.nth(0)).toContainText("Safety");

  await page.getByRole("tab", { name: "List" }).click();
  const outlineItems = page.getByRole("tabpanel").locator("ol > li");
  await expect(outlineItems.first()).toContainText("Safety");
  await outlineItems.first().getByRole("button", { name: "Remove" }).click();
  const removalDialog = page.getByRole("dialog");
  const dependentConfirmation = removalDialog.getByRole("checkbox");
  if (await dependentConfirmation.count()) await dependentConfirmation.check();
  await removalDialog
    .getByRole("button", { name: "Remove", exact: true })
    .click();
  await expectRevision(page, 6);
  await expect(outlineItems).toHaveCount(10);

  await page.getByRole("tab", { name: "Map" }).click();
  await expect(page.locator(".react-flow__node")).toHaveCount(10);
  await expect(page.locator(".react-flow__edge")).toHaveCount(0);
});

test("guided stages stay contained at supported teacher desktop widths", async ({
  page
}) => {
  for (const viewport of [
    { width: 768, height: 900 },
    { width: 1024, height: 768 },
    { width: 1366, height: 768 },
    { width: 1600, height: 768 },
    { width: 2560, height: 1080 }
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/teacher/lab-composer");
    for (const stage of [
      "Define",
      "Set up",
      "Workflow",
      "Assess",
      "Check & preview"
    ]) {
      await page.getByRole("button", { name: new RegExp(`^${stage}`) }).click();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth)
      ).toBeLessThanOrEqual(viewport.width);
    }
  }
});

test("validator issues identify and focus the responsible authoring stage", async ({
  page
}) => {
  const invalidDraft = {
    ...structuredClone(NATIVE_TITRATION_V2_DRAFT),
    layout: {
      ...structuredClone(NATIVE_TITRATION_V2_DRAFT.layout),
      placements: NATIVE_TITRATION_V2_DRAFT.layout.placements.slice(1)
    }
  };
  const name = "Issue navigation fixture";
  await page.addInitScript(
    ({ key, value }) => window.localStorage.setItem(key, value),
    {
      key: `${LOCAL_LAB_DRAFT_KEY_PREFIX}${encodeURIComponent(name)}`,
      value: serializeLabDraft(invalidDraft)
    }
  );

  await page.goto("/teacher/lab-composer");
  await page.getByRole("button", { name: /^Check & preview/ }).click();
  await page.getByLabel("Saved draft").selectOption(name);
  await page.getByRole("button", { name: "Load selected" }).click();
  await page.getByRole("button", { name: "Check lab" }).last().click();
  await expect(
    page
      .getByRole("region", { name: "Check and preview the lab" })
      .locator("code")
  ).toHaveCount(0);
  const issueLink = page.getByRole("button", { name: /^Review / }).first();
  await expect(issueLink).toBeVisible();
  await issueLink.click();
  await expect(
    page.getByRole("heading", { name: "Set up", exact: true })
  ).toBeFocused();
});

test("stage navigation is non-mutating and undo or redo never restores stale preview authority", async ({
  page
}) => {
  await page.goto("/teacher/lab-composer");
  const initialRevision = Number(
    await revisionMarker(page).getAttribute("data-draft-revision")
  );

  for (const stage of ["Set up", "Workflow", "Assess", "Define"]) {
    await page.getByRole("button", { name: new RegExp(`^${stage}`) }).click();
    await expectRevision(page, initialRevision);
  }

  await page
    .getByRole("button", { name: "Check lab", exact: true })
    .first()
    .click();
  await expect(page.getByText("Ready to preview")).toBeVisible();
  const significantFigures = page.getByRole("checkbox", {
    name: /^Significant Figures/i
  });
  await significantFigures.check();
  await expect(page.getByText("Needs checking")).toBeVisible();
  const editedRevision = Number(
    await revisionMarker(page).getAttribute("data-draft-revision")
  );

  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(significantFigures).not.toBeChecked();
  expect(
    Number(await revisionMarker(page).getAttribute("data-draft-revision"))
  ).toBeGreaterThan(editedRevision);
  await expect(
    page.getByRole("button", { name: "Preview", exact: true })
  ).toBeDisabled();

  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await expect(significantFigures).toBeChecked();
  await expect(page.getByText("Needs checking")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Preview", exact: true })
  ).toBeDisabled();
});

test("teacher validates, saves, reloads, and previews the exact current definition", async ({
  page
}) => {
  test.setTimeout(60_000);
  const browserErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  page.on("pageerror", (error) => browserErrors.push(error.message));
  await page.goto("/teacher/lab-composer");

  await page.getByRole("button", { name: /^Check & preview/ }).click();
  await page.getByRole("button", { name: "Check lab" }).last().click();
  await expect(page.getByText("Ready to preview")).toBeVisible();
  await expect(page.getByText("Passed", { exact: true })).toBeVisible();
  await expect(page.getByText("Ready", { exact: true })).toBeVisible();
  await expect(page.getByText("Technical details")).toHaveCount(0);
  await expect(page.getByText(/runtime-adapter\./)).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Preview", exact: true })
  ).toBeEnabled();
  await expect(page.getByRole("button", { name: "Assign" })).toBeDisabled();

  await page.getByLabel("Local draft name").fill("Saved endpoint practice");
  await page.getByRole("button", { name: "Save locally" }).click();
  await expect(page.getByRole("status")).toContainText(
    "Saved “Saved endpoint practice”"
  );

  await page.getByRole("button", { name: /^Define/ }).click();
  await page.getByRole("checkbox", { name: /^Significant Figures/i }).check();
  await expect(page.getByText("Needs checking")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Preview", exact: true })
  ).toBeDisabled();

  await page.getByRole("button", { name: /^Check & preview/ }).click();
  await page.getByRole("button", { name: "Load selected" }).click();
  await expect(page.getByRole("status")).toContainText(
    "Loaded “Saved endpoint practice”"
  );
  await expect(
    page.getByRole("button", { name: "Preview", exact: true })
  ).toBeDisabled();
  await page.getByRole("button", { name: "Check lab" }).last().click();

  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await expect(page).toHaveURL(/\/teacher\/lab-composer\/preview\?hash=/);
  await expect(page.getByTestId("composer-preview")).toBeVisible();
  await expect(page.getByTestId("composer-preview")).not.toContainText(
    "sha256:"
  );
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
  await expect(
    page.getByRole("button", { name: "Record meniscus reading" })
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Burette", exact: true }).click();
  await expect(page.getByText(/Workflow range per addition/)).toContainText(
    "0.01–0.50 mL"
  );
  await page.getByLabel("Volume to add (mL)").fill("0.51");
  await page.getByRole("button", { name: "Add titrant", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "permits at most 0.50 mL" })
  ).toBeVisible();
  await page.getByLabel("Volume to add (mL)").fill("0.50");
  await page.getByLabel("Delivery time (seconds)").fill("25");
  await page.getByRole("button", { name: "Add titrant", exact: true }).click();
  expect(browserErrors).toEqual([]);

  await page.getByRole("link", { name: /Return to Composer/ }).click();
  await expect(page).toHaveURL(/\/teacher\/lab-composer$/);
  await expect(page.getByRole("status")).toContainText(
    "Your lab is still here"
  );
  await expect(
    page.getByRole("button", { name: "Preview", exact: true })
  ).toBeDisabled();
});

test("preview route fails closed for a missing or stale local hash", async ({
  page
}) => {
  await page.goto(
    "/teacher/lab-composer/preview?hash=sha256%3A0000000000000000000000000000000000000000000000000000000000000000"
  );
  await expect(
    page.getByRole("heading", { name: "Preview unavailable" })
  ).toBeVisible();
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "preview is no longer available" })
  ).toContainText("preview is no longer available");
});

test("teacher can start a blank lab and reselect the titration template (LC2-412)", async ({
  page
}) => {
  await page.goto("/teacher/lab-composer");
  await expect(page.getByLabel("Lab title")).toHaveValue(/endpoint control/i);

  await page.getByRole("button", { name: "New lab" }).click();
  await page.getByRole("menuitem", { name: /Start from scratch/ }).click();

  await expect(page.getByLabel("Lab title")).toHaveValue("New lab");
  await expect(
    page.getByRole("button", { name: /Define/ }).filter({
      hasText: "Choose at least one objective"
    })
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Preview", exact: true })
  ).toBeDisabled();

  await page.getByRole("button", { name: "New lab" }).click();
  await page.getByRole("menuitem", { name: /titration template/i }).click();
  await expect(page.getByLabel("Lab title")).toHaveValue(/endpoint control/i);
});

test("teacher authors, saves, loads, and completes the shared solution-preparation preview (LC2-503)", async ({
  page
}) => {
  test.setTimeout(60_000);
  const browserErrors: string[] = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.goto("/teacher/lab-composer");

  await page.getByRole("button", { name: "New lab" }).click();
  await page
    .getByRole("menuitem", { name: "Solution preparation template" })
    .click();
  await expect(page.getByLabel("Lab title")).toHaveValue(
    "Prepare a sodium chloride dilution"
  );
  await expect(page.getByLabel("Stock concentration")).toHaveCount(0);

  await page.getByRole("button", { name: /^Check & preview/ }).click();
  await page.getByLabel("Local draft name").fill("Saved solution practice");
  await page.getByRole("button", { name: "Save locally" }).click();
  await expect(page.getByRole("status")).toContainText(
    "Saved “Saved solution practice”"
  );

  await page.getByRole("button", { name: /^Define/ }).click();
  await page.getByLabel("Lab title").fill("Temporary edited title");
  await page.getByRole("button", { name: "Save definition" }).click();
  await expect(page.getByText("Needs checking")).toBeVisible();
  await page.getByRole("button", { name: /^Check & preview/ }).click();
  await page.getByLabel("Saved draft").selectOption("Saved solution practice");
  await page.getByRole("button", { name: "Load selected" }).click();
  await page.getByRole("button", { name: /^Define/ }).click();
  await expect(page.getByLabel("Lab title")).toHaveValue(
    "Prepare a sodium chloride dilution"
  );

  await page
    .getByRole("button", { name: "Check lab", exact: true })
    .first()
    .click();
  await expect(page.getByText("Ready to preview")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Preview", exact: true })
  ).toBeEnabled();
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await expect(page).toHaveURL(/\/teacher\/lab-composer\/preview\?hash=/);
  await expect(page.getByTestId("setup-driven-student-bench")).toBeVisible();
  await expect(page.locator("[data-workflow-status]")).toHaveAttribute(
    "data-workflow-status",
    "in_progress"
  );
  await page.context().setOffline(true);

  const conditionStep = page.getByRole("group", {
    name: "Condition the pipette"
  });
  await conditionStep.getByRole("button", { name: "Apply step" }).click();
  await expect(conditionStep).toContainText(
    "Completed — the pipette is conditioned with stock solution."
  );
  await expect(
    page
      .getByRole("group", { name: "Measure stock solution into the pipette" })
      .getByRole("button", { name: "Apply step" })
  ).toBeEnabled();

  for (const name of [
    "Measure stock solution into the pipette",
    "Deliver the aliquot into the flask",
    "Fill the flask to the mark",
    "Mix the prepared solution"
  ]) {
    const apply = page
      .getByRole("group", { name })
      .getByRole("button", { name: "Apply step" });
    await apply.focus();
    await apply.press("Enter");
  }

  await expect(page.locator("[data-workflow-status]")).toHaveAttribute(
    "data-workflow-status",
    "completed"
  );
  await page.getByText("Teacher preview evidence").click();
  await expect(
    page.getByText("Solution concentration", { exact: true })
  ).toBeVisible();
  await expect(page.getByText("0.05 mol/L", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Solution volume", { exact: true })
  ).toBeVisible();
  await expect(page.getByText("100 mL", { exact: true })).toBeVisible();
  await expect(page.getByText("All required work complete")).toBeVisible();
  await expect(page.getByTestId("composer-preview")).not.toContainText(
    /sha256:|rule\.|observable\.|objectiveIds|runtime-adapter/i
  );
  await page.setViewportSize({ width: 768, height: 900 });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth)
  ).toBeLessThanOrEqual(768);
  await page.context().setOffline(false);
  expect(browserErrors).toEqual([]);
});

test("required-field controls disable instead of failing silently (LC2-413)", async ({
  page
}) => {
  await page.goto("/teacher/lab-composer");

  // Add direction is disabled until Title and Guidance are filled.
  await page.getByRole("button", { name: /^Workflow/ }).click();
  const addDirection = page.getByRole("button", { name: /^Add direction$/ });
  await expect(addDirection).toBeDisabled();
  await page.getByLabel("Title").fill("Read the meniscus");
  await expect(addDirection).toBeDisabled();
  await page.getByLabel("Guidance").fill("Record the value at eye level.");
  await expect(addDirection).toBeEnabled();

  // Clearing the duration must not silently become 0; Save definition disables.
  await page.getByRole("button", { name: /^Define/ }).click();
  await page.getByLabel("Duration in minutes").fill("");
  await expect(
    page.getByRole("button", { name: "Save definition" })
  ).toBeDisabled();
  await page.getByLabel("Duration in minutes").fill("15");
  await expect(
    page.getByRole("button", { name: "Save definition" })
  ).toBeEnabled();
});

test("unsaved authoring survives a page refresh (LC2-410)", async ({
  page
}) => {
  await page.goto("/teacher/lab-composer");

  await page.getByRole("button", { name: /^Workflow/ }).click();
  await page.getByLabel("Title").fill("QA persistence marker");
  await page.getByLabel("Guidance").fill("This direction must survive reload.");
  await page.getByRole("button", { name: /^Add direction$/ }).click();
  await expect(page.getByText("QA persistence marker")).toBeVisible();

  // Allow the autosave debounce to flush before reloading.
  await page.waitForTimeout(700);
  await page.reload();

  await expect(page.getByText("Restored your unsaved lab")).toBeVisible();
  await page.getByRole("button", { name: /^Workflow/ }).click();
  await expect(page.getByText("QA persistence marker")).toBeVisible();
});
