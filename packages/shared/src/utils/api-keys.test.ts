import { describe, expect, it } from "vitest";

import { isApiKeyDead } from "./api-keys";

describe("shared/utils:isApiKeyDead", () => {
  const now = Date.UTC(2026, 0, 10);

  it("keeps a live key alive", () => {
    expect(isApiKeyDead({ expiresAt: null, revoked: false, revokedAfter: null }, now)).toBe(false);
  });

  it("kills a key revoked without a grace window", () => {
    expect(isApiKeyDead({ expiresAt: null, revoked: true, revokedAfter: null }, now)).toBe(true);
  });

  it("respects an open grace window over the revoked flag", () => {
    const live = isApiKeyDead(
      { expiresAt: null, revoked: true, revokedAfter: new Date(now + 1) },
      now,
    );
    const closed = isApiKeyDead(
      { expiresAt: null, revoked: true, revokedAfter: new Date(now) },
      now,
    );

    expect(live).toBe(false);
    expect(closed).toBe(true);
  });

  it("kills a key past its expiry", () => {
    expect(
      isApiKeyDead({ expiresAt: new Date(now), revoked: false, revokedAfter: null }, now),
    ).toBe(true);
  });
});
