import { beforeEach, describe, expect, it, vi } from "vitest";

const afterMock = vi.hoisted(() => vi.fn());

vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  after: afterMock,
}));

// The production fallback only runs outside dev/test, so the module under test must see neither.
vi.mock("@/shared/config/env.flags", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  IS_DEV: false,
  IS_TEST: false,
}));

const { runAsBackgroundTask } = await import("./db");

describe("runAsBackgroundTask", () => {
  beforeEach(() => {
    afterMock.mockReset();
  });

  it("should hand the task to after() and return before it runs", async () => {
    afterMock.mockImplementation(() => undefined);
    const task = vi.fn(async () => undefined);

    await runAsBackgroundTask(task);

    expect(afterMock).toHaveBeenCalledWith(task);
    expect(task).not.toHaveBeenCalled();
  });

  it("should not await the task when after() reports no request context", async () => {
    afterMock.mockImplementation(() => {
      throw new Error("`after` was called outside a request scope");
    });

    let taskFinished = false;
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const task = vi.fn(async () => {
      await gate;
      taskFinished = true;
    });

    await runAsBackgroundTask(task);

    expect(task).toHaveBeenCalledOnce();
    expect(taskFinished).toBe(false);

    release();
    await gate;
  });

  it("should await the task when after() fails for an unrelated reason", async () => {
    afterMock.mockImplementation(() => {
      throw new Error("cache is on fire");
    });

    let taskFinished = false;
    const task = vi.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      taskFinished = true;
    });

    await runAsBackgroundTask(task);

    expect(task).toHaveBeenCalledOnce();
    expect(taskFinished).toBe(true);
  });
});
