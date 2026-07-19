import type { NextConfig } from "next";

import { assertProductionEnvironment } from "./src/lib/env";

assertProductionEnvironment();

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  turbopack: {
    root: process.cwd()
  }
};

export default nextConfig;
