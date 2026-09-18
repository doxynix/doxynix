import { describe, expect, it } from "vitest";

import { maskApiKey } from "./api-keys.utils";

describe("maskApiKey", () => {
  it("should return default fallback mask with dxnx prefix when prefix is empty string", () => {
    const result = maskApiKey("");
    expect(result).toBe("dxnx_••••••••••••••••••••••••••••••••••••••••••••••••••••");
  });

  it("should append mask characters to a provided custom token prefix", () => {
    const result = maskApiKey("my_prefix_");
    expect(result).toBe("my_prefix_••••••••••••••••••••••••••••••••••••••••••••••••••••");
  });

  it("should gracefully handle null or undefined values by returning default fallback mask", () => {
    expect(maskApiKey(null)).toBe("dxnx_••••••••••••••••••••••••••••••••••••••••••••••••••••");
    expect(maskApiKey(undefined)).toBe("dxnx_••••••••••••••••••••••••••••••••••••••••••••••••••••");
  });
});
