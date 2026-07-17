import { chromium } from "@playwright/test";

const baseURL = process.env.LABBENCH_BASE_URL ?? "http://127.0.0.1:3000";
const sampleDurationMS = 5_000;
const browser = await chromium.launch({
  headless: true,
  args: ["--enable-unsafe-swiftshader"]
});

try {
  const page = await browser.newPage({
    viewport: { width: 1366, height: 768 }
  });
  await page.addInitScript(() => {
    window.__labRenderedFrameTimes = [];
    window.__labbenchLabFrameProbe = (time) => {
      const recorded = window.__labRenderedFrameTimes;
      if (recorded.at(-1) !== time) recorded.push(time);
    };
  });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await cdp.send("Performance.enable");
  await page.goto(`${baseURL}/lab/titration?seed=chromebook-profile`, {
    waitUntil: "networkidle"
  });
  await page.getByText("3D bench ready", { exact: true }).waitFor({
    timeout: 30_000
  });

  const canvasFrame = page.getByRole("application", {
    name: "Interactive 3D lab camera"
  });
  const bounds = await canvasFrame.boundingBox();
  if (!bounds) throw new Error("Could not measure the 3D canvas bounds.");

  await canvasFrame.click({
    position: { x: bounds.width * 0.9, y: bounds.height * 0.1 }
  });
  await page.waitForSelector('[data-look-active="true"]', { timeout: 5_000 });
  await page.waitForTimeout(100);

  const before = await cdp.send("Performance.getMetrics");
  const frameSample = await page.evaluate(async (durationMS) => {
    const scheduledFrameTimes = [];
    const startedAt = performance.now();
    const renderedStartIndex = window.__labRenderedFrameTimes.length;
    const canvas = document.querySelector("canvas");
    if (!canvas) throw new Error("The WebGL canvas is unavailable.");
    const canvasBounds = canvas.getBoundingClientRect();
    window.dispatchEvent(
      new PointerEvent("pointermove", {
        clientX: canvasBounds.right - 4,
        clientY: canvasBounds.top + canvasBounds.height / 2,
        bubbles: true
      })
    );
    await new Promise((resolve) => {
      const frame = (now) => {
        scheduledFrameTimes.push(now);
        if (now - startedAt >= durationMS) resolve();
        else requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    });
    const endedAt = performance.now();
    const elapsedMS = endedAt - startedAt;
    const renderedFrameTimes =
      window.__labRenderedFrameTimes.slice(renderedStartIndex);
    const renderIntervals = renderedFrameTimes
      .slice(1)
      .map((time, index) => time - renderedFrameTimes[index]);
    return {
      scheduledFrames: scheduledFrameTimes.length,
      renderedFrames: renderedFrameTimes.length,
      elapsedMS,
      averageScheduledFPS: (scheduledFrameTimes.length * 1000) / elapsedMS,
      averageRenderFPS: (renderedFrameTimes.length * 1000) / elapsedMS,
      slowRenderFramePercent:
        (renderIntervals.filter((interval) => interval > 33.34).length /
          Math.max(1, renderIntervals.length)) *
        100
    };
  }, sampleDurationMS);
  const after = await cdp.send("Performance.getMetrics");
  const metric = (metrics, name) =>
    metrics.metrics.find((candidate) => candidate.name === name)?.value ?? 0;
  const taskDurationS =
    metric(after, "TaskDuration") - metric(before, "TaskDuration");

  const result = {
    profile: "headless Chromium, SwiftShader, 4x CPU throttle, 1366x768",
    route: "/lab/titration",
    ...frameSample,
    mainThreadUtilizationPercent: Math.min(
      100,
      (taskDurationS / (frameSample.elapsedMS / 1000)) * 100
    ),
    jsHeapUsedMB: metric(after, "JSHeapUsedSize") / 1024 / 1024
  };
  console.log(JSON.stringify(result, null, 2));

  if (frameSample.averageRenderFPS < 25) process.exitCode = 1;
} finally {
  await browser.close();
}
