import { beforeEach, describe, expect, it, vi } from "vitest";

const { appLoggerMock, publishMock, requestMock } = vi.hoisted(() => ({
  appLoggerMock: { error: vi.fn() },
  publishMock: vi.fn(),
  requestMock: vi.fn(),
}));

vi.mock("ably", () => ({
  default: {
    Rest: class {
      channels = { get: () => ({ publish: publishMock }) };
      request = requestMock;
    },
  },
}));

vi.mock("@/server/core/app-logger", () => ({ appLogger: appLoggerMock }));

// The real flags short-circuit every publish on `IS_TEST`, which is what the suite runs under.
vi.mock("@/shared/config/env.flags", () => ({
  IS_ANALYZE: false,
  IS_CI: true,
  IS_DEV: false,
  IS_PROD: false,
  IS_RATE_LIMIT_ENABLED: true,
  IS_TEST: false,
}));

import { realtimeService } from "./realtime";

const events = [
  { data: {}, name: "user-updated" },
  { data: { id: "notification-1", title: "Analysis ready" }, name: "notification" },
  { data: {}, name: "analysis-updated" },
] as const;

describe("realtimeService.userBatch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("publishes every event in one accepted batch request", async () => {
    requestMock.mockResolvedValue({ statusCode: 201, success: true });

    await realtimeService.userBatch("user-1", [...events]);

    expect(requestMock).toHaveBeenCalledTimes(1);
    expect(requestMock).toHaveBeenCalledWith(
      "post",
      "/messages",
      2,
      {},
      {
        channels: ["user:user-1"],
        messages: events,
      },
    );
    expect(publishMock).not.toHaveBeenCalled();
    expect(appLoggerMock.error).not.toHaveBeenCalled();
  });

  it("falls back to sequential publishes when the request rejects", async () => {
    requestMock.mockRejectedValue(new Error("batch unavailable"));

    await realtimeService.userBatch("user-1", [...events]);

    expect(requestMock).toHaveBeenCalledTimes(1);
    expect(publishMock.mock.calls).toStrictEqual(events.map(({ data, name }) => [name, data]));
    expect(appLoggerMock.error).toHaveBeenCalledTimes(1);
  });

  it("falls back when Ably answers with an error status", async () => {
    requestMock.mockResolvedValue({
      errorCode: 40_020,
      errorMessage: "batch publish failed",
      statusCode: 500,
      success: false,
    });

    await realtimeService.userBatch("user-1", [...events]);

    expect(publishMock.mock.calls).toStrictEqual(events.map(({ data, name }) => [name, data]));
    expect(appLoggerMock.error).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: "user:user-1",
        errorCode: 40_020,
        statusCode: 500,
        userId: "user-1",
      }),
    );
  });

  it("skips the request when there is no channel or nothing to send", async () => {
    await realtimeService.userBatch(null, [...events]);
    await realtimeService.userBatch("user-1", []);

    expect(requestMock).not.toHaveBeenCalled();
    expect(publishMock).not.toHaveBeenCalled();
  });
});
