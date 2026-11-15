import { beforeEach, describe, expect, it, vi } from "vitest";

const { publishMock, requestMock } = vi.hoisted(() => ({
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

  it("publishes every event in one batch request", async () => {
    requestMock.mockResolvedValue({});

    await expect(realtimeService.userBatch("user-1", [...events])).resolves.toBe(true);

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
  });

  it("falls back to sequential publishes when the batch request fails", async () => {
    requestMock.mockRejectedValue(new Error("batch unavailable"));

    await expect(realtimeService.userBatch("user-1", [...events])).resolves.toBe(false);

    expect(requestMock).toHaveBeenCalledTimes(1);
    expect(publishMock.mock.calls).toStrictEqual(events.map(({ data, name }) => [name, data]));
  });

  it("skips the request when there is no channel or nothing to send", async () => {
    await expect(realtimeService.userBatch(null, [...events])).resolves.toBe(false);
    await expect(realtimeService.userBatch("user-1", [])).resolves.toBe(false);

    expect(requestMock).not.toHaveBeenCalled();
    expect(publishMock).not.toHaveBeenCalled();
  });
});
