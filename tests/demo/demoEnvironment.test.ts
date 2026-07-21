import { describe, expect, it } from "vitest";

import {
  DEMO_AREA_PREFIX,
  ISOLATED_PRODUCTION_ENDPOINTS,
  isDemoPathname,
  resolveApiPath
} from "../../src/lib/demo/demoEnvironment";

/**
 * The judge demo is only "controlled" if its surfaces actually reach the
 * mirrored endpoints. These assertions pin the routing rule that makes that
 * true, and the boundary that keeps production traffic out of it.
 */
describe("judge demo environment", () => {
  it("routes every isolated endpoint to a demo mirror inside the demo area", () => {
    for (const productionPath of ISOLATED_PRODUCTION_ENDPOINTS) {
      const resolved = resolveApiPath(productionPath, "/demo/lab/titration");
      expect(resolved, productionPath).not.toBe(productionPath);
      expect(resolved, productionPath).toMatch(/^\/api\/demo\//);
    }
  });

  it("leaves production surfaces on production endpoints", () => {
    for (const pathname of [
      "/lab/titration",
      "/lab/calorimetry",
      "/lab-composer",
      "/teacher/classes",
      "/"
    ]) {
      for (const productionPath of ISOLATED_PRODUCTION_ENDPOINTS) {
        expect(resolveApiPath(productionPath, pathname)).toBe(productionPath);
      }
    }
  });

  it("treats the demo root and its descendants as the demo area", () => {
    expect(isDemoPathname(DEMO_AREA_PREFIX)).toBe(true);
    expect(isDemoPathname("/demo/labs")).toBe(true);
    expect(isDemoPathname("/demo/lab/silver-chloride")).toBe(true);
    expect(isDemoPathname("/demo/composer")).toBe(true);
  });

  it("does not treat a path merely prefixed with 'demo' as the demo area", () => {
    // A route such as /demonstration must keep production endpoints.
    expect(isDemoPathname("/demonstration")).toBe(false);
    expect(isDemoPathname("/demo-teacher")).toBe(false);
    expect(resolveApiPath("/api/coach", "/demonstration")).toBe("/api/coach");
  });

  it("passes through an endpoint that has no demo mirror", () => {
    // Unmirrored routes are used as-is inside the demo, not silently dropped.
    expect(resolveApiPath("/api/realtime-token", "/demo/labs")).toBe(
      "/api/realtime-token"
    );
  });
});
