import type { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

function createRequest(headers: Record<string, string> = {}): NextRequest {
  return {
    headers: new Headers(headers),
  } as NextRequest;
}

describe("request-context getCountry in production", () => {
  afterEach(() => {
    vi.resetModules();
    vi.doUnmock("@/shared/constants/env.flags");
  });

  it("should return UNKNOWN in production when geo and headers are missing", async () => {
    vi.doMock("@/shared/constants/env.flags", () => ({
      IS_PROD: true,
    }));

    const { getCountry } = await import("@/server/shared/lib/request-context");

    expect(getCountry(createRequest())).toBe("UNKNOWN");
  });
});
