import { describe, expect, it } from "vitest";

import { readViewerRole, roleHomePath } from "../../src/lib/auth/roles";

describe("readViewerRole", () => {
  it("accepts the two roles the profiles check constraint allows", () => {
    expect(readViewerRole("student")).toBe("student");
    expect(readViewerRole("teacher")).toBe("teacher");
  });

  /*
   * The role arrives from a database row, a URL parameter, and a form field.
   * Anything else is treated as "no role", which routes to the picker rather
   * than granting the weaker or stronger side by accident.
   */
  it("rejects everything else", () => {
    for (const value of [
      null,
      undefined,
      "",
      "admin",
      "Teacher",
      "student ",
      0,
      1,
      true,
      {},
      ["teacher"]
    ]) {
      expect(readViewerRole(value)).toBeNull();
    }
  });
});

describe("roleHomePath", () => {
  it("routes each role to its own workspace", () => {
    expect(roleHomePath("teacher")).toBe("/teacher/classes");
    expect(roleHomePath("student")).toBe("/assignments");
  });

  /*
   * Students used to land on /assignments from the OAuth callback but
   * /experiments from the role picker, so where you ended up depended on which
   * path created your profile.
   */
  it("gives one answer per role regardless of caller", () => {
    expect(roleHomePath("student")).toBe(roleHomePath("student"));
    expect(roleHomePath("teacher")).not.toBe(roleHomePath("student"));
  });

  it("sends an account with no role to the picker", () => {
    expect(roleHomePath(null)).toBe("/auth/role");
  });

  it("never routes a role to the sign-in page", () => {
    for (const role of ["student", "teacher", null] as const) {
      expect(roleHomePath(role)).not.toContain("/auth/sign-in");
    }
  });
});
