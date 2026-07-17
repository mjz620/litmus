import { describe, expect, it } from "vitest";

import {
  assertProductionEnvironment,
  getServerEnvironment
} from "../../src/lib/env";

describe("environment validation", () => {
  it("fails clearly when production persistence secrets are missing", () => {
    expect(() =>
      assertProductionEnvironment({ NODE_ENV: "production" })
    ).toThrow(
      "Invalid production environment: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY"
    );
  });

  it("does not require deployment credentials for local development", () => {
    expect(() =>
      assertProductionEnvironment({ NODE_ENV: "development" })
    ).not.toThrow();
  });

  it("keeps the service role server-only and parses configured values", () => {
    const environment = getServerEnvironment({
      NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key-that-is-long-enough",
      SUPABASE_SERVICE_ROLE_KEY: "service-key-that-is-long-enough"
    });
    expect(environment.SUPABASE_SERVICE_ROLE_KEY).toContain("service-key");
    expect(
      Object.keys(environment).some(
        (key) => key.startsWith("NEXT_PUBLIC_") && key.includes("SERVICE")
      )
    ).toBe(false);
  });
});
