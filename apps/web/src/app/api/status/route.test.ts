import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from "vitest";

const TEST_TOKEN = "test-token";

vi.hoisted(() => {
  process.env.BETTERSTACK_API_TOKEN = "test-token";
});

import { GET } from "@/app/api/status/route";

const ok = (body: unknown): Response =>
  new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status: 200,
  });

const monitor = (status: "down" | "maintenance" | "paused" | "pending" | "up", id = status) => ({
  attributes: { paused: false, status },
  id,
});

describe("status route", () => {
  let consoleErrorSpy: Mock;

  beforeEach(() => {
    vi.stubEnv("BETTERSTACK_API_TOKEN", TEST_TOKEN);
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('returns { status: "up" } when all monitors are up or pending', async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        ok({
          data: [monitor("up"), monitor("pending")],
        }),
      ),
    );

    const res = await GET();
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ status: "up" });
  });

  it('prioritizes "down" over "maintenance" and "up"', async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        ok({
          data: [monitor("up"), monitor("maintenance"), monitor("down")],
        }),
      ),
    );

    const res = await GET();
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ status: "down" });
  });

  it('returns { status: "maintenance" } when no monitor is down', async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        ok({
          data: [monitor("up"), monitor("maintenance")],
        }),
      ),
    );

    const res = await GET();
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ status: "maintenance" });
  });

  it('returns { status: "unknown" } with HTTP 200 when the upstream responds with an error', async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("upstream error", { status: 500 })),
    );

    const res = await GET();
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ status: "unknown" });
  });

  it("logs the error and returns unknown when fetch rejects", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network failure")));

    const res = await GET();
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ status: "unknown" });
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it("sends the Betterstack token as a Bearer authorization header", async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok({ data: [monitor("up")] }));
    vi.stubGlobal("fetch", fetchMock);

    await GET();

    expect(fetchMock).toHaveBeenCalledWith(
      "https://uptime.betterstack.com/api/v2/monitors",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: `Bearer ${TEST_TOKEN}`,
        }),
      }),
    );
  });
});
