import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("getCookieName runtime branches", () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it("should return secure cookie name in production mode", async () => {
    vi.stubEnv("NODE_ENV", "production");

    const { getCookieName } = await import("@/shared/lib/utils");

    expect(getCookieName()).toBe("__Secure-next-auth.session-token");
  });

  it("should return standard cookie name in development mode", async () => {
    vi.stubEnv("NODE_ENV", "development");

    const { getCookieName } = await import("@/shared/lib/utils");

    expect(getCookieName()).toBe("next-auth.session-token");
  });
});
