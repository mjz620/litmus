import { describe, expect, it } from "vitest";

import { sha256Hex } from "../../src/lab-workflows/sha256";

describe("platform-neutral workflow SHA-256", () => {
  it.each([
    ["", "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"],
    ["abc", "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"],
    [
      "LabBench 🧪\0é",
      "8ce338817a9cc0979b253b992e417e420300614932b704e1074f1f92d74ce8e6"
    ]
  ])("matches the frozen UTF-8 vector for %j", (input, expected) => {
    expect(sha256Hex(input)).toBe(expected);
  });
});
