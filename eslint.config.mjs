import { defineConfig, globalIgnores } from "eslint/config";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextCoreWebVitals,
  ...nextTypeScript,
  globalIgnores([
    ".next/**",
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
    "labbench_codex_workflow_pack/**",
    "next-env.d.ts"
  ]),
  {
    /*
     * Engine code is isomorphic, and not by convention: lab sessions are
     * constructed during server render, so chemistry and workflow runtime code
     * executes at build time on the static lab routes. A browser global here
     * fails `next build` rather than degrading in the browser, and the error
     * surfaces far from its cause. AGENTS.md states the rule; this enforces it.
     *
     * The 3D scene, stores, and UI are client-only and are not covered.
     */
    files: ["src/experiments/**/*.ts", "src/lab-workflows/**/*.ts"],
    rules: {
      "no-restricted-globals": [
        "error",
        { name: "window", message: "Engine code runs during server render." },
        { name: "document", message: "Engine code runs during server render." },
        { name: "navigator", message: "Engine code runs during server render." },
        { name: "localStorage", message: "Engine code runs during server render." },
        { name: "sessionStorage", message: "Engine code runs during server render." },
        { name: "requestAnimationFrame", message: "Engine code runs during server render." }
      ],
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "react", message: "Engine code must not depend on React." },
            { name: "three", message: "Engine code must not depend on Three.js." }
          ],
          patterns: [
            {
              group: ["@react-three/*", "next/*", "@supabase/*"],
              message:
                "Engine code must stay isomorphic and free of framework, rendering, and transport dependencies."
            }
          ]
        }
      ]
    }
  }
]);
