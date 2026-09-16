import { beforeEach, describe, expect, it, vi } from "vitest";

// --- Hoisted mocks ---
const mocks = vi.hoisted(() => {
  const mockPinoInstance = {
    debug: vi.fn(),
    error: vi.fn(),
    flush: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  };

  return {
    loggerCtor: class MockLogger {
      error = vi.fn();
      flush = vi.fn().mockResolvedValue(undefined);
      info = vi.fn();
    },
    mockPinoInstance,
    pino: vi.fn(() => mockPinoInstance),
    pinoPretty: vi.fn(() => ({ write: vi.fn() })),
    requestContext: { getStore: vi.fn(() => ({ requestId: "req-1" })) },
    sanitizePayload: vi.fn((d: unknown) => d),
  };
});

vi.mock("next-axiom", () => ({ Logger: mocks.loggerCtor }));
vi.mock("pino", () => ({ default: mocks.pino }));
vi.mock("pino-pretty", () => ({ default: mocks.pinoPretty }));
vi.mock("@/server/utils/request-context", () => ({ requestContext: mocks.requestContext }));
vi.mock("@/server/utils/sanitize-payload", () => ({ sanitizePayload: mocks.sanitizePayload }));
vi.mock("@/shared/config/env.flags", () => ({ IS_PROD: false }));

import { appLogger } from "./app-logger";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("appLogger (non-prod)", () => {
  it("info serializes Error to {kind, message, stack}", () => {
    const err = new Error("boom");
    appLogger.info({ error: err, msg: "hello" });

    const [rest, message] = mocks.mockPinoInstance.info.mock.calls[0]!;

    expect(message).toBe("hello");
    expect(rest).toMatchObject({
      error: { kind: "Error", message: "boom", stack: expect.any(String) },
      requestId: "req-1",
    });
  });

  it("info without error passes fields through sanitizePayload", () => {
    appLogger.info({ code: 42, msg: "ok" });

    const [rest, message] = mocks.mockPinoInstance.info.mock.calls[0]!;

    expect(message).toBe("ok");
    expect(rest).toMatchObject({ code: 42, requestId: "req-1" });
    expect(mocks.sanitizePayload).toHaveBeenCalled();
  });

  it("warn calls pino warn with store-merged payload", () => {
    appLogger.warn({ code: 42, msg: "w" });

    const [rest, message] = mocks.mockPinoInstance.warn.mock.calls[0]!;

    expect(message).toBe("w");
    expect(rest).toMatchObject({ code: 42, requestId: "req-1" });
  });

  it("debug calls pino debug", () => {
    appLogger.debug({ msg: "dbg" });

    expect(mocks.mockPinoInstance.debug).toHaveBeenCalled();
    const [, message] = mocks.mockPinoInstance.debug.mock.calls[0]!;
    expect(message).toBe("dbg");
  });

  it("error calls pino error", () => {
    appLogger.error({ error: new Error("x"), msg: "err" });

    expect(mocks.mockPinoInstance.error).toHaveBeenCalled();
    const [, message] = mocks.mockPinoInstance.error.mock.calls[0]!;
    expect(message).toBe("err");
  });

  it("flush is a no-op in non-prod (no axiom logger)", async () => {
    await expect(appLogger.flush()).resolves.toBeUndefined();

    expect(mocks.mockPinoInstance.flush).not.toHaveBeenCalled();
  });
});
