import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/{components,experiments,stores,unit}/**/*.test.ts"]
  }
});
