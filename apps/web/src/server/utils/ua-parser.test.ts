import { describe, expect, it } from "vitest";

import { formatUserAgent } from "./ua-parser";

describe("formatUserAgent", () => {
  it("returns a system label for synthetic or null user agents", () => {
    expect(formatUserAgent(null)).toBe("System");
    expect(formatUserAgent("internal")).toBe("System");
  });

  it("formats parsed browser, operating system, and device details", () => {
    const formatted = formatUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    );

    expect(formatted).toContain("Chrome");
    expect(formatted).toContain("macOS");
  });
});
