import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DbClient } from "@/server/core/db";

import { onboardingService } from "./onboarding.service";

const USER_ID = "0195a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5d";

const { publish, trackServerEvent } = vi.hoisted(() => ({
  publish: vi.fn(),
  trackServerEvent: vi.fn(),
}));

vi.mock("@/server/core/realtime", () => ({
  realtimeService: {
    user: () => ({ publish }),
  },
}));

vi.mock("@/server/core/posthog-events", () => ({
  trackServerEvent,
}));

function makeDb(overrides: { user?: Record<string, unknown> }): DbClient {
  return {
    user: {
      findUnique: vi.fn().mockResolvedValue({
        onboardingCompletedAt: null,
        onboardingIntent: "ARCHITECTURE",
      }),
      update: vi.fn().mockResolvedValue({}),
      ...overrides.user,
    },
  } as unknown as DbClient;
}

describe("onboardingService.completeOnboarding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("writes onboardingCompletedAt on first completion and tracks the event", async () => {
    const db = makeDb({});

    await onboardingService.completeOnboarding(db, USER_ID, false);

    expect(db.user.update).toHaveBeenCalledWith({
      data: { onboardingCompletedAt: expect.any(Date) },
      where: { id: USER_ID },
    });
    expect(publish).toHaveBeenCalledTimes(1);
    expect(trackServerEvent).toHaveBeenCalledWith(
      "onboarding_completed",
      { intent: "ARCHITECTURE" },
      USER_ID,
    );
  });

  it("tracks skipped instead of completed", async () => {
    const db = makeDb({});

    await onboardingService.completeOnboarding(db, USER_ID, true);

    expect(trackServerEvent).toHaveBeenCalledWith(
      "onboarding_skipped",
      { intent: "ARCHITECTURE" },
      USER_ID,
    );
  });

  it("is idempotent once completedAt is set", async () => {
    const db = makeDb({
      user: {
        findUnique: vi.fn().mockResolvedValue({
          onboardingCompletedAt: new Date("2026-10-25T10:00:00Z"),
          onboardingIntent: "ARCHITECTURE",
        }),
      },
    });

    await onboardingService.completeOnboarding(db, USER_ID, false);

    expect(db.user.update).not.toHaveBeenCalled();
    expect(trackServerEvent).not.toHaveBeenCalled();
  });
});

describe("onboardingService.saveOnboardingIdentity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("writes name and intent and publishes a user update", async () => {
    const db = makeDb({});

    await onboardingService.saveOnboardingIdentity(db, USER_ID, {
      intent: "RISKS",
      name: "Karen",
    });

    expect(db.user.update).toHaveBeenCalledWith({
      data: { name: "Karen", onboardingIntent: "RISKS" },
      where: { id: USER_ID },
    });
    expect(publish).toHaveBeenCalledTimes(1);
  });
});

describe("onboardingService.setOnboardingChecklistCollapsed", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sets a timestamp when collapsing", async () => {
    const db = makeDb({});

    await onboardingService.setOnboardingChecklistCollapsed(db, USER_ID, true);

    expect(db.user.update).toHaveBeenCalledWith({
      data: { onboardingChecklistDismissedAt: expect.any(Date) },
      where: { id: USER_ID },
    });
  });

  it("clears the timestamp when expanding", async () => {
    const db = makeDb({});

    await onboardingService.setOnboardingChecklistCollapsed(db, USER_ID, false);

    expect(db.user.update).toHaveBeenCalledWith({
      data: { onboardingChecklistDismissedAt: null },
      where: { id: USER_ID },
    });
  });
});
