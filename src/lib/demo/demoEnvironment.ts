/**
 * The judge demo is a controlled environment: the same interface a student or
 * teacher sees, served from its own route area and backed by its own API
 * endpoints.
 *
 * Isolating the endpoints is what makes it controlled. The production routes
 * authenticate, consume shared LLM budget, and write checkpoints to the real
 * database — none of which a signed-out evaluator should touch, and all of
 * which surface as 401s and "Save failed" banners that read as product faults.
 * The demo mirrors of those routes admit guests and persist nothing.
 *
 * Resolution is by pathname rather than a build flag or a React context so a
 * shared client (the coach client, the checkpoint transport, the report form)
 * picks the right endpoint wherever it is mounted, with no per-surface wiring
 * to forget.
 */

export const DEMO_AREA_PREFIX = "/demo";

/**
 * Production path → demo mirror. A production route with no entry here is used
 * unchanged inside the demo; add an entry only when the demo needs isolation
 * from real auth, budget, or storage.
 */
const DEMO_ENDPOINTS: Readonly<Record<string, string>> = Object.freeze({
  "/api/coach": "/api/demo/coach",
  "/api/evaluate": "/api/demo/evaluate",
  "/api/sessions/checkpoint": "/api/demo/checkpoint"
});

/** Every production endpoint the demo area redirects to a mirror. */
export const ISOLATED_PRODUCTION_ENDPOINTS: readonly string[] = Object.freeze(
  Object.keys(DEMO_ENDPOINTS)
);

/** Whether a pathname is inside the judge demo area. */
export function isDemoPathname(pathname: string): boolean {
  return (
    pathname === DEMO_AREA_PREFIX || pathname.startsWith(`${DEMO_AREA_PREFIX}/`)
  );
}

/**
 * The endpoint a surface at `pathname` should call for `productionPath`.
 * Outside the demo area this is always the production path.
 */
export function resolveApiPath(
  productionPath: string,
  pathname: string
): string {
  if (!isDemoPathname(pathname)) return productionPath;
  return DEMO_ENDPOINTS[productionPath] ?? productionPath;
}

/**
 * Endpoint for the surface making the call right now. On the server there is
 * no ambient pathname, so the production path stands — every isolated endpoint
 * is called from the browser.
 */
export function currentApiPath(productionPath: string): string {
  if (typeof window === "undefined") return productionPath;
  return resolveApiPath(productionPath, window.location.pathname);
}

export const DEMO_LABS_PATH = "/demo/labs";
export const EXPERIMENTS_PATH = "/experiments";

/**
 * Where a lab's "back" link should lead. Inside the demo it returns to the
 * demo's own lab index; anywhere else, to the product catalogue. A bench that
 * linked out to /experiments would drop an evaluator into the production app
 * mid-journey — and onto production endpoints.
 */
export function labsIndexHref(pathname: string): string {
  return isDemoPathname(pathname) ? DEMO_LABS_PATH : EXPERIMENTS_PATH;
}

export const DEMO_COMPOSER_PATH = "/demo/composer";
export const COMPOSER_PATH = "/lab-composer";
export const DEMO_COMPOSER_PREVIEW_PATH = "/demo/composer/preview";
export const COMPOSER_PREVIEW_PATH = "/teacher/lab-composer/preview";

/**
 * Where the Composer's Preview opens, and where that preview returns to.
 * Inside the demo both stay under /demo: sending an evaluator to the teacher
 * preview would drop them out of the playground shell mid-journey, the same
 * way a production lab link would.
 */
export function composerPreviewHref(pathname: string): string {
  return isDemoPathname(pathname)
    ? DEMO_COMPOSER_PREVIEW_PATH
    : COMPOSER_PREVIEW_PATH;
}

export function composerHref(pathname: string): string {
  return isDemoPathname(pathname) ? DEMO_COMPOSER_PATH : COMPOSER_PATH;
}
