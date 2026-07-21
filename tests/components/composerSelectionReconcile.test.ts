import { describe, expect, it } from "vitest";

import { reconciledSelection } from "../../src/components/teacher/lab-composer/selection";

/*
 * A <select> whose value matches no option displays its first entry. The
 * Composer stored these ids once at mount and refreshed them only when a draft
 * was loaded, so adding or removing a rule mid-session left the stored id
 * stale while the dropdown showed a real-looking choice. "Add direction" then
 * failed with "a related item is missing" against a dropdown that plainly
 * showed an item.
 */
describe("composer selection reconciliation", () => {
  it("keeps a selection that is still offered", () => {
    expect(reconciledSelection("rule.b", ["rule.a", "rule.b"])).toBe("rule.b");
  });

  it("falls back to the first option when the selection was removed", () => {
    // The stale case: the chosen rule was deleted while the panel stayed open.
    expect(reconciledSelection("rule.deleted", ["rule.a", "rule.b"])).toBe(
      "rule.a"
    );
  });

  it("adopts the first option once one becomes available", () => {
    // The empty case: the panel mounted before any rule existed.
    expect(reconciledSelection("", ["rule.a"])).toBe("rule.a");
  });

  it("stays empty when nothing is offered", () => {
    expect(reconciledSelection("rule.a", [])).toBe("");
    expect(reconciledSelection("", [])).toBe("");
  });

  it("always returns something the caller can actually submit", () => {
    // The invariant the bug violated: the resolved id is offered, or is empty
    // so the control stays disabled — never a value that looks valid and is not.
    const options = ["rule.a", "rule.b"];
    for (const candidate of ["", "rule.a", "rule.b", "rule.gone"]) {
      const resolved = reconciledSelection(candidate, options);
      expect(resolved === "" || options.includes(resolved)).toBe(true);
    }
  });
});
