/**
 * Capture the product screenshots the landing page ships.
 *
 * The landing page claims a student can handle real apparatus and that a
 * teacher can read back what happened. Those claims are worth more shown than
 * asserted, so the imagery on that page is captured from the running app
 * rather than drawn. Re-run this whenever a captured surface changes:
 *
 *   npm run dev
 *   node scripts/capture-landing-shots.mjs            # defaults to :3000
 *   LANDING_SHOT_BASE_URL=http://localhost:3109 node scripts/capture-landing-shots.mjs
 */
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "@playwright/test";

const baseURL = process.env.LANDING_SHOT_BASE_URL ?? "http://localhost:3000";
const outDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../public/landing"
);

/** Wide enough that the bench reads as apparatus, not as a thumbnail. */
const VIEWPORT = { width: 1440, height: 900 };

/**
 * Every student lab opens on a briefing before the 3D workspace mounts. A
 * screenshot of the briefing is a screenshot of a wall of text, so pass
 * through it the same way the e2e helpers do.
 */
async function startLab(page) {
  const start = page.getByRole("button", { name: "Start the lab" });
  // The briefing is client-rendered, so the button is not in the DOM at
  // domcontentloaded. Waiting for it is what separates a screenshot of the
  // bench from a screenshot of the briefing that precedes it.
  await start.waitFor({ state: "visible", timeout: 60_000 });
  await start.click();
  await start.waitFor({ state: "hidden", timeout: 60_000 });

  // Some labs report "3D bench ready" once, then remount while the session
  // config resolves, which is how a capture run ends up holding a screenshot
  // of "Preparing your lab session…". Require the bench to still be mounted
  // after it settles rather than trusting the first ready signal.
  const bench = page.getByRole("region", { name: "Interactive lab bench" });
  for (let attempt = 0; attempt < 6; attempt += 1) {
    await bench.waitFor({ state: "visible", timeout: 120_000 });
    await page.waitForTimeout(4_000);
    if (await bench.isVisible().catch(() => false)) return;
  }
  throw new Error("bench never stayed mounted");
}

const shots = [
  {
    name: "bench-titration",
    url: "/lab/titration",
    prepare: startLab
  },
  {
    name: "bench-calorimetry",
    url: "/lab/calorimetry",
    prepare: startLab
  },
  {
    name: "bench-solution-preparation",
    url: "/lab/solution-preparation",
    prepare: startLab
  },
  // The lab routes own their session bar, so those shots keep their chrome.
  // These two are ordinary pages under the product header, and a landing page
  // that frames the Litmus header inside its own reads as a page in a page.
  {
    name: "composer",
    url: "/lab-composer",
    cropHeader: true
  },
  {
    name: "experiments",
    url: "/experiments",
    cropHeader: true
  }
];

// Pass shot names to re-capture a subset: `node scripts/capture-landing-shots.mjs bench-titration`
const only = new Set(process.argv.slice(2));
const selected = only.size ? shots.filter((s) => only.has(s.name)) : shots;

const browser = await chromium.launch({
  args: ["--enable-unsafe-swiftshader"]
});
const context = await browser.newContext({
  viewport: VIEWPORT,
  deviceScaleFactor: 2,
  reducedMotion: "reduce"
});

await mkdir(outDir, { recursive: true });

for (const shot of selected) {
  const page = await context.newPage();
  try {
    await page.goto(`${baseURL}${shot.url}`, {
      waitUntil: "domcontentloaded",
      timeout: 60_000
    });
    if (shot.prepare) await shot.prepare(page);
    // The 3D scenes settle a frame or two after they report ready.
    await page.waitForTimeout(3_000);
    let clip;
    if (shot.cropHeader) {
      const box = await page.locator("header").first().boundingBox();
      const top = Math.round(box?.height ?? 0);
      clip = {
        x: 0,
        y: top,
        width: VIEWPORT.width,
        height: VIEWPORT.height - top
      };
    }

    const file = path.join(outDir, `${shot.name}.png`);
    await page.screenshot({ path: file, clip });
    console.log(`captured ${shot.name} <- ${shot.url}`);
  } catch (error) {
    console.error(`FAILED ${shot.name} <- ${shot.url}: ${error.message}`);
  } finally {
    await page.close();
  }
}

await context.close();
await browser.close();
