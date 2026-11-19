import { readFileSync } from "node:fs";

import { join } from "pathe";
import { beforeEach, describe, expect, it, vi } from "vitest";

type HookArgs = { ctx: { run: { id: string } }; next: () => Promise<void> };
type Hook = (args: HookArgs) => Promise<unknown>;

const mocks = vi.hoisted(() => {
  const handlers: Record<string, Hook> = {};
  const localValues = new Map<unknown, unknown>();
  const connect = vi.fn(async () => {});
  const disconnect = vi.fn(async () => {});

  const capture =
    (name: string) =>
    (...args: unknown[]) => {
      handlers[name] = args.at(-1) as Hook;
    };

  return {
    capture,
    handlers,
    localValues,
    prisma: { $connect: connect, $disconnect: disconnect },
    setLocal: vi.fn((key: unknown, value: unknown) => {
      localValues.set(key, value);
    }),
  };
});

vi.mock("@/server/core/db", () => ({ prisma: mocks.prisma }));

vi.mock("@/server/core/app-logger", () => ({
  appLogger: { debug: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

vi.mock("@/server/core/posthog-events", () => ({ trackServerEvent: vi.fn() }));

vi.mock("@/server/core/realtime", () => ({
  realtimeService: { user: vi.fn(() => ({ publish: vi.fn() })) },
}));

vi.mock("@trigger.dev/sdk", () => ({
  locals: {
    create: (name: string) => ({ name }),
    getOrThrow: (key: unknown) => {
      if (!mocks.localValues.has(key)) {
        throw new Error("Prisma local is not set");
      }
      return mocks.localValues.get(key);
    },
    set: mocks.setLocal,
  },
  tasks: {
    middleware: vi.fn(mocks.capture("middleware")),
    onCancel: vi.fn(mocks.capture("onCancel")),
    onComplete: vi.fn(mocks.capture("onComplete")),
    onFailure: vi.fn(mocks.capture("onFailure")),
    onResume: vi.fn(mocks.capture("onResume")),
    onStartAttempt: vi.fn(mocks.capture("onStartAttempt")),
    onWait: vi.fn(mocks.capture("onWait")),
  },
}));

import { getTaskPrisma } from "./init";

const source = readFileSync(join(import.meta.dirname, "init.ts"), "utf8");

function hook(name: string): Hook {
  const handler = mocks.handlers[name];
  if (!handler) {
    throw new Error(`${name} hook was not registered`);
  }
  return handler;
}

const runCtx = () => ({ run: { id: "run_test" } });

const nextMock = () => vi.fn(async () => {});

beforeEach(() => {
  mocks.prisma.$connect.mockClear();
  mocks.prisma.$disconnect.mockClear();
  mocks.setLocal.mockClear();
});

describe("prisma connection manager middleware", () => {
  it("exposes the shared pool to the run", async () => {
    const next = nextMock();
    await hook("middleware")({ ctx: runCtx(), next });

    expect(next).toHaveBeenCalledOnce();
    expect(mocks.setLocal).toHaveBeenCalledWith(expect.anything(), mocks.prisma);
    expect(getTaskPrisma()).toBe(mocks.prisma);
  });

  it("leaves the pool open once the run finishes", async () => {
    await hook("middleware")({ ctx: runCtx(), next: nextMock() });

    expect(mocks.prisma.$connect).not.toHaveBeenCalled();
    expect(mocks.prisma.$disconnect).not.toHaveBeenCalled();
  });

  it("leaves the pool open when the run fails", async () => {
    const next = vi.fn(async () => {
      throw new Error("run failed");
    });

    await expect(hook("middleware")({ ctx: runCtx(), next })).rejects.toThrow("run failed");
    expect(mocks.prisma.$disconnect).not.toHaveBeenCalled();
  });

  it("keeps the pool open across consecutive runs in one worker", async () => {
    await hook("middleware")({ ctx: runCtx(), next: nextMock() });
    await hook("middleware")({ ctx: runCtx(), next: nextMock() });

    expect(mocks.prisma.$disconnect).not.toHaveBeenCalled();
  });

  it("releases the connection only while the run waits", async () => {
    await hook("onWait")({ ctx: runCtx(), next: nextMock() });

    expect(mocks.prisma.$disconnect).toHaveBeenCalledOnce();
  });

  it("reacquires the connection when the run resumes", async () => {
    await hook("onResume")({ ctx: runCtx(), next: nextMock() });

    expect(mocks.prisma.$connect).toHaveBeenCalledOnce();
  });
});

describe("analysis task reliability analytics", () => {
  it("covers every platform lifecycle hook", () => {
    expect(source).toContain("tasks.onComplete");
    expect(source).toContain("tasks.onCancel");
    expect(source).toContain("tasks.onFailure");
  });

  it("distinguishes platform failures from in-task failures", () => {
    expect(source).toContain('source: "platform"');
  });

  it("labels each platform trigger distinctly", () => {
    expect(source).toContain('"task_timeout"');
    expect(source).toContain('"manual_cancel"');
    expect(source).toContain('"platform_failure"');
  });

  it("never forwards the raw error text to analytics", () => {
    expect(source).not.toMatch(/trackServerEvent\([^)]*errorMsg/);
  });

  it("reports a null duration rather than zero for platform failures", () => {
    expect(source).toContain("duration_ms: null");
  });
});
