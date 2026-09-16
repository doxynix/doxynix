import { beforeEach, describe, expect, it, vi } from "vitest";

// --- Hoisted mocks ---
const mocks = vi.hoisted(() => {
  const axiomInstance = {
    error: vi.fn(),
    flush: vi.fn().mockResolvedValue(undefined),
    info: vi.fn(),
  };

  const pinoInstance = {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  };

  return {
    axiomInstance,
    loggerCtor: vi.fn(function () {
      return axiomInstance;
    }),
    pino: vi.fn(() => pinoInstance),
    pinoInstance,
    requestContext: { getStore: vi.fn(() => ({ requestId: "prod-req" })) },
    sanitizePayload: vi.fn((d: unknown) => d),
  };
});

vi.mock("next-axiom", () => ({ Logger: mocks.loggerCtor }));
vi.mock("pino", () => ({ default: mocks.pino }));
vi.mock("pino-pretty", () => ({ default: vi.fn() }));
vi.mock("@/server/utils/request-context", () => ({ requestContext: mocks.requestContext }));
vi.mock("@/server/utils/sanitize-payload", () => ({ sanitizePayload: mocks.sanitizePayload }));
vi.mock("@/shared/config/env.flags", () => ({ IS_PROD: true }));

import { appLogger } from "./app-logger";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("appLogger (IS_PROD)", () => {
  it("info uses axiomLogger instead of pino", () => {
    const err = new Error("prod-boom");
    appLogger.info({ error: err, msg: "hello" });

    expect(mocks.axiomInstance.info).toHaveBeenCalledWith("hello", {
      error: { kind: "Error", message: "prod-boom", stack: expect.any(String) },
      requestId: "prod-req",
    });
    // pino should NOT be called in prod
    expect(mocks.pinoInstance.info).not.toHaveBeenCalled();
  });

  it("flush calls axiomLogger.flush in prod", async () => {
    await appLogger.flush();

    expect(mocks.axiomInstance.flush).toHaveBeenCalledTimes(1);
  });
});
