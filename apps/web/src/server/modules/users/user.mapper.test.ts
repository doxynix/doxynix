import { describe, expect, it } from "vitest";

import { userMapper } from "./user.mapper";

type SessionRecord = Parameters<typeof userMapper.toSession>[0];

const RAW_TOKEN = "kQ7h2vXrT9wLmZ4pB6yN0cJ8sD1fG5aH3eU7iO2lP4rS";

function makeSession(overrides?: Partial<SessionRecord>): SessionRecord {
  return {
    createdAt: new Date("2026-03-01T12:00:00Z"),
    expiresAt: new Date("2026-04-01T12:00:00Z"),
    id: "018f0000-0000-7000-8000-0000000000a1",
    ipAddress: "203.0.113.7",
    token: RAW_TOKEN,
    updatedAt: new Date("2026-03-01T12:00:00Z"),
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
    userId: "7",
    ...overrides,
  };
}

describe("userMapper.toSession", () => {
  it("never emits the session token, under any key", () => {
    const mapped = userMapper.toSession(makeSession());

    expect(mapped).not.toHaveProperty("token");
    expect(Object.values(mapped).map((value) => JSON.stringify(value))).not.toContain(
      JSON.stringify(RAW_TOKEN),
    );
  });

  it("emits exactly the display fields, so no credential can appear later by accident", () => {
    expect(Object.keys(userMapper.toSession(makeSession())).sort()).toEqual([
      "createdAt",
      "id",
      "ipAddress",
      "userAgent",
    ]);
  });

  it("keeps `id`, which is the identity the UI revokes by", () => {
    expect(userMapper.toSession(makeSession()).id).toBe("018f0000-0000-7000-8000-0000000000a1");
  });

  it("formats the user agent and passes the session metadata through", () => {
    const mapped = userMapper.toSession(makeSession({ ipAddress: null, userAgent: "internal" }));

    expect(mapped.createdAt).toEqual(new Date("2026-03-01T12:00:00Z"));
    expect(mapped.ipAddress).toBeNull();
    expect(mapped.userAgent).toBe("System");
  });
});
