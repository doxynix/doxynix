import { beforeEach, describe, expect, it, vi } from "vitest";

const { captureMock, identifyMock, resetMock, sessionIdMock } = vi.hoisted(() => ({
  captureMock: vi.fn(),
  identifyMock: vi.fn(),
  resetMock: vi.fn(),
  sessionIdMock: vi.fn(() => "session-abc"),
}));

vi.mock("posthog-js", () => ({
  default: {
    capture: captureMock,
    get_session_id: sessionIdMock,
    identify: identifyMock,
    reset: resetMock,
  },
}));

import { getClientSessionId, identifyUser, trackClientEvent } from "./posthog-client";

describe("trackClientEvent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("forwards the event name and properties", () => {
    trackClientEvent("doc_viewed", { doc_type: "README", repo_id: "repo-1" });

    expect(captureMock).toHaveBeenCalledWith("doc_viewed", {
      doc_type: "README",
      repo_id: "repo-1",
    });
  });

  it("defaults properties to an empty object", () => {
    trackClientEvent("github_app_install_started");

    expect(captureMock).toHaveBeenCalledWith("github_app_install_started", {});
  });

  it("does not throw on circular property values", () => {
    const circular: Record<string, unknown> = { name: "x" };
    circular.self = circular;

    expect(() => trackClientEvent("repo_added", { repo: circular })).not.toThrow();
  });
});

describe("getClientSessionId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the current posthog session id", () => {
    expect(getClientSessionId()).toBe("session-abc");
  });
});

describe("identifyUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("identifies with the role and signup cohort", () => {
    identifyUser({
      createdAt: new Date("2026-03-14T09:00:00.000Z"),
      role: "ADMIN",
      twoFactorEnabled: true,
      userId: "user-1",
    });

    expect(identifyMock).toHaveBeenCalledWith("user-1", {
      name: "",
      role: "ADMIN",
      signup_cohort: "2026-03",
      two_factor_enabled: true,
    });
  });

  it("pads single-digit months in the cohort", () => {
    identifyUser({
      createdAt: new Date("2025-11-02T00:00:00.000Z"),
      role: "USER",
      twoFactorEnabled: false,
      userId: "user-2",
    });

    expect(identifyMock).toHaveBeenCalledWith(
      "user-2",
      expect.objectContaining({ signup_cohort: "2025-11" }),
    );
  });

  it("uses UTC so the cohort does not shift near midnight", () => {
    identifyUser({
      createdAt: new Date("2026-01-01T00:30:00.000Z"),
      role: "USER",
      userId: "user-3",
    });

    expect(identifyMock).toHaveBeenCalledWith(
      "user-3",
      expect.objectContaining({ signup_cohort: "2026-01" }),
    );
  });

  it("normalizes an absent 2FA flag to false", () => {
    identifyUser({
      createdAt: new Date("2026-03-14T09:00:00.000Z"),
      role: "USER",
      userId: "user-4",
    });

    expect(identifyMock).toHaveBeenCalledWith(
      "user-4",
      expect.objectContaining({ two_factor_enabled: false }),
    );
  });

  it("resets identity when signed out", () => {
    identifyUser(null);

    expect(resetMock).toHaveBeenCalledTimes(1);
    expect(identifyMock).not.toHaveBeenCalled();
  });
});
