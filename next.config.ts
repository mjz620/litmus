import type { NextConfig } from "next";

import { assertProductionEnvironment } from "./src/lib/env";

assertProductionEnvironment();

const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd()
  }
};

export default nextConfig;
