import { describe, expect, it, vi } from "vitest";

const { captureMock } = vi.hoisted(() => ({ captureMock: vi.fn() }));

vi.mock("@/server/core/posthog-server", () => ({
  captureServerEvent: captureMock,
  isPostHogServerEnabled: () => true,
}));

const { storeMock } = vi.hoisted(() => ({ storeMock: vi.fn() }));

vi.mock("@/server/utils/request-context", () => ({
  requestContext: { getStore: storeMock },
}));

import { resolveDistinctId, trackServerEvent } from "./posthog-events";

describe("resolveDistinctId", () => {
  it("prefers an explicit id over ambient context", () => {
    storeMock.mockReturnValue({ userId: "ambient-user" });

    expect(resolveDistinctId("explicit-user")).toBe("explicit-user");
  });

  it("falls back to the ambient request user", () => {
    storeMock.mockReturnValue({ userId: "ambient-user" });

    expect(resolveDistinctId()).toBe("ambient-user");
  });

  it("returns undefined outside a request and without an explicit id", () => {
    storeMock.mockReturnValue(undefined);

    expect(resolveDistinctId()).toBeUndefined();
  });
});

describe("trackServerEvent", () => {
  it("defaults properties to an empty object", () => {
    storeMock.mockReturnValue(undefined);

    trackServerEvent("repo_analysis_queued", undefined, "user-1");

    expect(captureMock).toHaveBeenCalledWith("repo_analysis_queued", {}, "user-1");
  });

  it("forwards properties untouched", () => {
    storeMock.mockReturnValue(undefined);

    trackServerEvent("repo_analysis_completed", { duration_ms: 1200 }, "user-1");

    expect(captureMock).toHaveBeenCalledWith(
      "repo_analysis_completed",
      { duration_ms: 1200 },
      "user-1",
    );
  });

  it("resolves the distinct id from ambient context when none is passed", () => {
    storeMock.mockReturnValue({ userId: "ambient-user" });

    trackServerEvent("repo_analysis_failed");

    expect(captureMock).toHaveBeenCalledWith("repo_analysis_failed", {}, "ambient-user");
  });
});
