import { describe, expect, it, vi } from "vitest";

import { AppError } from "@/server/utils/api-error";
import { requestContext } from "@/server/utils/request-context";
import { withApiHandler } from "@/server/utils/with-api-handler";

const mocks = vi.hoisted(() => ({
  appLogger: { error: vi.fn(), flush: vi.fn(), warn: vi.fn() },
}));

vi.mock("@/server/core/app-logger", () => ({ appLogger: mocks.appLogger }));

const req = (headers?: Record<string, string>) =>
  new Request("http://localhost/api/things", { headers });

describe("withApiHandler", () => {
  it("returns the handler's response untouched on the happy path", async () => {
    const handler = withApiHandler(async () => new Response("ok", { status: 201 }));

    const res = await handler(req());

    expect(res.status).toBe(201);
    await expect(res.text()).resolves.toBe("ok");
    expect(mocks.appLogger.error).not.toHaveBeenCalled();
  });

  it("serializes an expected AppError at its own status and logs at warn", async () => {
    const handler = withApiHandler(async () => {
      throw new AppError({ code: "NOT_FOUND", publicMessage: "Repository not found" });
    });

    const res = await handler(req({ "x-request-id": "req-1" }));

    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({
      error: { code: "NOT_FOUND", message: "Repository not found", requestId: "req-1" },
    });
    expect(mocks.appLogger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ code: "NOT_FOUND", kind: "app" }),
    );
    expect(mocks.appLogger.error).not.toHaveBeenCalled();
  });

  it("logs an unexpected failure at error level with the cause intact", async () => {
    const cause = new TypeError("kaboom");
    const handler = withApiHandler(async () => {
      throw cause;
    });

    const res = await handler(req());

    expect(res.status).toBe(500);
    expect(mocks.appLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.any(Error), unexpected: true }),
    );
  });

  it("establishes a requestContext so appLogger lines carry a requestId", async () => {
    let seen: string | undefined;

    const handler = withApiHandler(async () => {
      seen = requestContext.getStore()?.requestId;
      return new Response("ok");
    });

    await handler(req({ "x-request-id": "ctx-1" }));

    expect(seen).toBe("ctx-1");
  });

  it("reuses an outer store instead of clobbering a richer one", async () => {
    let seen: string | undefined;

    const handler = withApiHandler(async () => {
      seen = requestContext.getStore()?.path;
      return new Response("ok");
    });

    const outer = {
      appVersion: "1.0.0",
      country: "LOCAL",
      ip: null,
      method: "webhook",
      path: "/api/webhooks/github",
      requestId: "outer-1",
      userAgent: "test",
    };

    await requestContext.run(outer, () => handler(req({ "x-request-id": "inner-1" })));

    expect(seen).toBe("/api/webhooks/github");
  });

  it("re-throws a Next redirect instead of converting it to a JSON 500", async () => {
    const redirectError = Object.assign(new Error("NEXT_REDIRECT"), {
      digest: "NEXT_REDIRECT;replace;/dashboard?error=x;303;",
    });

    const handler = withApiHandler(async () => {
      throw redirectError;
    });

    await expect(handler(req())).rejects.toBe(redirectError);
    expect(mocks.appLogger.error).not.toHaveBeenCalled();
  });

  it("re-throws Next notFound() / unauthorized() control-flow errors", async () => {
    for (const digest of ["NEXT_HTTP_ERROR_FALLBACK;404", "NEXT_HTTP_ERROR_FALLBACK;401"]) {
      const controlFlow = Object.assign(new Error(digest), { digest });
      const handler = withApiHandler(async () => {
        throw controlFlow;
      });

      await expect(handler(req())).rejects.toBe(controlFlow);
    }
  });

  it("accepts a zero-argument handler, for routes that read only headers()", async () => {
    const handler = withApiHandler(async () => new Response("ok"));

    await expect(handler(req())).resolves.toBeInstanceOf(Response);
  });

  it("does not flush in the test env", async () => {
    const handler = withApiHandler(async () => {
      throw new Error("boom");
    });

    await handler(req());

    expect(mocks.appLogger.flush).not.toHaveBeenCalled();
  });
});
