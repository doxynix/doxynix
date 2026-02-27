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
    vi.doUnmock("@/shared/constants/env.client");
  });

  it("should return UNKNOWN in production when geo and headers are missing", async () => {
    vi.doMock("@/shared/constants/env.client", () => ({
      IS_PROD: true,
    }));

    const { getCountry } = await import("@/server/utils/request-context");

    expect(getCountry(createRequest())).toBe("UNKNOWN");
  });
});
