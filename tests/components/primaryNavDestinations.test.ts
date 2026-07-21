import { describe, expect, it } from "vitest";

import {
  GUEST_DESTINATIONS,
  STUDENT_DESTINATIONS,
  TEACHER_DESTINATIONS,
  UNFINISHED_DESTINATIONS,
  destinationsFor
} from "../../src/components/ui/navDestinations";

const hrefs = (destinations: readonly { readonly href: string }[]) =>
  destinations.map((destination) => destination.href);

describe("primary nav destinations", () => {
  it("offers sign-in only to signed-out visitors", () => {
    expect(hrefs(destinationsFor(false, null))).toContain("/auth/sign-in");

    for (const role of ["student", "teacher", null] as const) {
      expect(hrefs(destinationsFor(true, role))).not.toContain("/auth/sign-in");
    }
  });

  it("offers the account page to every signed-in account with a role", () => {
    expect(hrefs(destinationsFor(true, "student"))).toContain("/account");
    expect(hrefs(destinationsFor(true, "teacher"))).toContain("/account");
  });

  it("never shows the account page to a guest", () => {
    expect(hrefs(destinationsFor(false, null))).not.toContain("/account");
  });

  it("keeps the teacher workspace out of the student and guest navs", () => {
    expect(hrefs(destinationsFor(true, "student"))).not.toContain(
      "/teacher/classes"
    );
    expect(hrefs(destinationsFor(false, null))).not.toContain(
      "/teacher/classes"
    );
    expect(hrefs(destinationsFor(true, "teacher"))).toContain(
      "/teacher/classes"
    );
  });

  it("keeps student-only destinations out of the teacher nav", () => {
    const teacher = hrefs(destinationsFor(true, "teacher"));
    expect(teacher).not.toContain("/assignments");
    expect(teacher).not.toContain("/join");
  });

  /*
   * The window between the OAuth callback and the role picker. Every other
   * signed-in destination bounces off /auth/role, so offering them would be a
   * nav full of links that go nowhere.
   */
  it("sends an account with no role to finish setup", () => {
    expect(hrefs(destinationsFor(true, null))).toContain("/auth/role");
    expect(destinationsFor(true, null)).toBe(UNFINISHED_DESTINATIONS);
  });

  it("selects one list per audience", () => {
    expect(destinationsFor(false, null)).toBe(GUEST_DESTINATIONS);
    expect(destinationsFor(true, "student")).toBe(STUDENT_DESTINATIONS);
    expect(destinationsFor(true, "teacher")).toBe(TEACHER_DESTINATIONS);
  });

  /*
   * A signed-out visitor carrying a stale role must still get the guest nav:
   * the role is only meaningful alongside a session.
   */
  it("ignores a role without a session", () => {
    expect(destinationsFor(false, "teacher")).toBe(GUEST_DESTINATIONS);
  });

  it("keeps guest practice reachable from every nav", () => {
    for (const destinations of [
      destinationsFor(false, null),
      destinationsFor(true, "student"),
      destinationsFor(true, "teacher"),
      destinationsFor(true, null)
    ]) {
      expect(hrefs(destinations)).toContain("/experiments");
    }
  });
});
