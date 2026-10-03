import { beforeEach, describe, expect, it, vi } from "vitest";

const { captureMock, constructorMock, shutdownMock } = vi.hoisted(() => ({
  captureMock: vi.fn(),
  constructorMock: vi.fn(),
  shutdownMock: vi.fn(),
}));

vi.mock("posthog-node", () => ({
  PostHog: class {
    capture = captureMock;
    shutdown = shutdownMock;

    constructor(apiKey: string, options: unknown) {
      constructorMock(apiKey, options);
    }
  },
}));

const HOST = "https://us.i.posthog.com";

async function loadServer(env: { apiKey: string; isProd: boolean }) {
  vi.resetModules();
  vi.doMock("@/shared/config/env.flags", () => ({ IS_PROD: env.isProd }));
  vi.doMock("@/shared/config/env.client", () => ({
    NEXT_PUBLIC_POSTHOG_KEY: env.apiKey,
  }));
  vi.doMock("@/shared/config/env.server", () => ({
    POSTHOG_HOST: HOST,
  }));

  return import("./posthog-server");
}

describe("posthog-server", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("is enabled in production when a key is present", async () => {
    const { isPostHogServerEnabled } = await loadServer({ apiKey: "phc_key", isProd: true });

    expect(isPostHogServerEnabled()).toBe(true);
  });

  it("is disabled outside production", async () => {
    const { captureServerEvent, isPostHogServerEnabled } = await loadServer({
      apiKey: "phc_key",
      isProd: false,
    });

    expect(isPostHogServerEnabled()).toBe(false);

    captureServerEvent("repo_analysis_queued");

    expect(constructorMock).not.toHaveBeenCalled();
    expect(captureMock).not.toHaveBeenCalled();
  });

  it("is disabled when the key is empty", async () => {
    const { isPostHogServerEnabled } = await loadServer({ apiKey: "", isProd: true });

    expect(isPostHogServerEnabled()).toBe(false);
  });

  it("targets the server ingestion host and reliability-grade flush", async () => {
    const { captureServerEvent } = await loadServer({ apiKey: "phc_key", isProd: true });

    captureServerEvent("repo_analysis_queued");

    expect(constructorMock).toHaveBeenCalledWith("phc_key", {
      flushAt: 1,
      flushInterval: 0,
      host: HOST,
    });
  });

  it("passes the distinct id and properties through", async () => {
    const { captureServerEvent } = await loadServer({ apiKey: "phc_key", isProd: true });

    captureServerEvent("repo_analysis_failed", { duration_ms: 1200 }, "user-1");

    expect(captureMock).toHaveBeenCalledWith({
      distinctId: "user-1",
      event: "repo_analysis_failed",
      properties: { duration_ms: 1200 },
    });
  });

  it("defaults properties to an empty object", async () => {
    const { captureServerEvent } = await loadServer({ apiKey: "phc_key", isProd: true });

    captureServerEvent("repo_analysis_queued");

    expect(captureMock).toHaveBeenCalledWith({
      distinctId: undefined,
      event: "repo_analysis_queued",
      properties: {},
    });
  });

  it("reuses one client across events", async () => {
    const { captureServerEvent } = await loadServer({ apiKey: "phc_key", isProd: true });

    captureServerEvent("repo_analysis_queued");
    captureServerEvent("repo_analysis_completed");

    expect(constructorMock).toHaveBeenCalledTimes(1);
  });

  it("shuts down and drops the client so the next event rebuilds it", async () => {
    const { captureServerEvent, shutdownPostHogServer } = await loadServer({
      apiKey: "phc_key",
      isProd: true,
    });

    captureServerEvent("repo_analysis_queued");
    await shutdownPostHogServer();

    expect(shutdownMock).toHaveBeenCalledTimes(1);

    captureServerEvent("repo_analysis_failed");

    expect(constructorMock).toHaveBeenCalledTimes(2);
  });

  it("shuts down cleanly when nothing was ever sent", async () => {
    const { shutdownPostHogServer } = await loadServer({ apiKey: "phc_key", isProd: true });

    await expect(shutdownPostHogServer()).resolves.toBeUndefined();
    expect(shutdownMock).not.toHaveBeenCalled();
  });
});
