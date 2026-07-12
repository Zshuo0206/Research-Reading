import { describe, expect, it } from "vitest";
import { isApiHostAllowed } from "../../apps/api/src/host-policy.js";
import { isWebHostAllowed } from "../../apps/web/host-policy.js";

describe.each([
  ["API", isApiHostAllowed],
  ["Web", isWebHostAllowed],
] as const)("%s platform host policy", (_name, isAllowed) => {
  it("allows loopback in ordinary local mode", () => {
    expect(isAllowed("127.0.0.1", false)).toBe(true);
  });

  it("rejects non-loopback in ordinary local mode", () => {
    expect(isAllowed("0.0.0.0", false)).toBe(false);
    expect(isAllowed("192.168.1.10", false)).toBe(false);
  });

  it("allows only 0.0.0.0 as the explicit container-mode exception", () => {
    expect(isAllowed("0.0.0.0", true)).toBe(true);
    expect(isAllowed("192.168.1.10", true)).toBe(false);
  });
});
