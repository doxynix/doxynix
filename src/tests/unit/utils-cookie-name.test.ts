import { afterEach, describe, expect, it, vi } from "vitest";

describe("getCookieName runtime branches", () => {
  afterEach(() => {
    vi.resetModules();
    vi.doUnmock("@/shared/constants/env.client");
  });

  it("should return secure cookie name in production mode", async () => {
    vi.doMock("@/shared/constants/env.client", () => ({
      IS_PROD: true,
    }));

    const { getCookieName } = await import("@/shared/lib/utils");

    expect(getCookieName()).toBe("__Secure-next-auth.session-token");
  });
});
