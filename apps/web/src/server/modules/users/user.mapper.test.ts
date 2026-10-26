import { describe, expect, it } from "vitest";

import { userMapper } from "./user.mapper";

type SessionRecord = Parameters<typeof userMapper.toSession>[0];

const RAW_TOKEN = "kQ7h2vXrT9wLmZ4pB6yN0cJ8sD1fG5aH3eU7iO2lP4rS";

// The row carries more columns than the mapper reads, so the "no credential leaks"
// assertions stay meaningful.
function makeSession(overrides?: Record<string, unknown>): SessionRecord {
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
  } as SessionRecord;
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

type AdminUserSummaryRecord = Parameters<typeof userMapper.toAdminSummary>[0];

function makeAdminUser(overrides?: Partial<AdminUserSummaryRecord>): AdminUserSummaryRecord {
  return {
    banExpires: null,
    banned: false,
    banReason: null,
    createdAt: new Date("2026-03-01T12:00:00Z"),
    email: "karen@example.com",
    emailHash: "0".repeat(64),
    emailVerified: true,
    id: "018f0000-0000-7000-8000-0000000000b2",
    image: null,
    imageKey: "avatars/karen.png",
    lastLoginMethod: "github",
    name: "Karen",
    role: "USER",
    twoFactorEnabled: false,
    updatedAt: new Date("2026-03-02T12:00:00Z"),
    ...overrides,
  } as AdminUserSummaryRecord;
}

describe("userMapper.toAdminSummary", () => {
  it("emits exactly the moderation fields, so a column cannot leak in later", () => {
    expect(Object.keys(userMapper.toAdminSummary(makeAdminUser())).sort()).toEqual([
      "banExpires",
      "banReason",
      "banned",
      "createdAt",
      "email",
      "emailVerified",
      "id",
      "image",
      "lastLoginMethod",
      "name",
      "role",
      "twoFactorEnabled",
      "updatedAt",
    ]);
  });

  it("never emits the email hash or the blob key, even though the record carries them", () => {
    const mapped = userMapper.toAdminSummary(makeAdminUser());
    const serialized = Object.values(mapped).map((value) => JSON.stringify(value));

    expect(serialized).not.toContain(JSON.stringify("0".repeat(64)));
    expect(serialized).not.toContain(JSON.stringify("avatars/karen.png"));
  });
});

describe("userMapper.toAdminDetail", () => {
  it("lifts the relation counts out of `_count` and keeps the summary fields", () => {
    const mapped = userMapper.toAdminDetail({
      ...makeAdminUser(),
      _count: { apiKeys: 2, chatSession: 1, notifications: 7, repos: 3, sessions: 4 },
    });

    expect(mapped.counts).toEqual({
      apiKeys: 2,
      chatSessions: 1,
      notifications: 7,
      repos: 3,
      sessions: 4,
    });
    expect(mapped).not.toHaveProperty("_count");
    expect(mapped.id).toBe("018f0000-0000-7000-8000-0000000000b2");
  });
});
