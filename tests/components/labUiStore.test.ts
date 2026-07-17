import { beforeEach, describe, expect, it } from "vitest";

import { useLabUiStore } from "../../src/stores/labUiStore";

describe("lab UI store", () => {
  beforeEach(() => {
    useLabUiStore.setState({
      focused: null,
      hovered: null,
      lookActive: false
    });
  });

  it("owns focused, hovered, and look-active presentation state", () => {
    const { setFocused, setHovered, setLookActive } = useLabUiStore.getState();

    setFocused("burette");
    setHovered("meniscus");
    setLookActive(true);

    expect(useLabUiStore.getState()).toMatchObject({
      focused: "burette",
      hovered: "meniscus",
      lookActive: true
    });
  });

  it("clears focus without changing hover or look state", () => {
    useLabUiStore.setState({
      focused: "flask",
      hovered: "burette",
      lookActive: true
    });

    useLabUiStore.getState().clearFocus();

    expect(useLabUiStore.getState()).toMatchObject({
      focused: null,
      hovered: "burette",
      lookActive: true
    });
  });
});
