import { expect, test } from "@playwright/test";

import { generateTitrationSessionConfig } from "../../src/experiments/titration/sessionConfig";
import { equivalenceVolumeML } from "../../src/experiments/titration/titration";

/**
 * Pick deterministic regression seeds whose generated values make leak checks
 * unambiguous: the unknown analyte concentration must differ from the visible
 * titrant concentration, and the equivalence volume must not collide with
 * numbers the student page legitimately displays on a fresh session.
 */
function selectRegressionSeeds(count: number): string[] {
  const legitimateFreshPageNumbers = new Set(["0.00", "50.00"]);
  const seeds: string[] = [];

  for (let index = 0; seeds.length < count && index < 500; index += 1) {
    const candidate = `leak-regression-${index}`;
    const config = generateTitrationSessionConfig(candidate);
    const equivalenceText = equivalenceVolumeML(config).toFixed(2);

    if (
      config.analyte.concentrationM !== config.titrant.concentrationM &&
      !legitimateFreshPageNumbers.has(equivalenceText)
    ) {
      seeds.push(candidate);
    }
  }

  return seeds;
}

const regressionSeeds = selectRegressionSeeds(3);

test("selected regression seeds cover distinct configurations", () => {
  expect(regressionSeeds).toHaveLength(3);
});

for (const seed of regressionSeeds) {
  test(`student surface never shows the answer for seed ${seed}`, async ({
    page
  }) => {
    const config = generateTitrationSessionConfig(seed);
    const equivalenceML = equivalenceVolumeML(config);

    await page.goto(`/lab/titration?seed=${seed}&runtime=setup-v2`);

    const bodyText = await page.locator("body").innerText();

    // Known, student-appropriate values are present.
    expect(bodyText).toContain(
      `${config.analyte.volumeML.toFixed(1)} mL ${config.analyte.name}`
    );
    expect(bodyText).toContain(
      `${config.titrant.concentrationM.toFixed(3)} M ${config.titrant.name}`
    );

    // The unknown analyte concentration never appears, in any format,
    // attached to the analyte name.
    const analyteConcentrationPattern = new RegExp(
      `\\d(?:\\.\\d+)?\\s*M\\s+${config.analyte.name}`
    );
    expect(bodyText).not.toMatch(analyteConcentrationPattern);
    expect(bodyText).not.toContain(
      `${config.analyte.concentrationM.toFixed(3)} M`
    );

    // The equivalence volume (the answer's location) never appears.
    expect(bodyText).not.toContain(equivalenceML.toFixed(2));

    // Internal diagnostics never appear.
    expect(bodyText).not.toContain(seed);
    const lowerBodyText = bodyText.toLowerCase();
    expect(lowerBodyText).not.toContain("session seed");
    expect(lowerBodyText).not.toContain("events recorded");
    expect(lowerBodyText).not.toContain("skills tracked");
    expect(lowerBodyText).not.toContain("equivalence");
    expect(lowerBodyText).not.toContain("acid_base_titration");
  });
}

test("a shared seed produces the same configuration on both routes without exposing it to students", async ({
  page
}) => {
  const seed = regressionSeeds[0]!;
  const expectedConfig = generateTitrationSessionConfig(seed);

  await page.goto(`/dev/lab/titration?seed=${seed}`);
  await expect(page.getByTestId("dev-session-seed")).toHaveText(seed);
  const devConfigText = await page.getByTestId("dev-config").innerText();
  expect(JSON.parse(devConfigText)).toEqual(expectedConfig);

  await page.goto(`/lab/titration?seed=${seed}&runtime=setup-v2`);

  // The student page reflects the same generated configuration through its
  // known values only.

  const bodyText = await page.locator("body").innerText();
  expect(bodyText).not.toContain(
    `${expectedConfig.analyte.concentrationM.toFixed(3)} M ${expectedConfig.analyte.name}`
  );
});
