import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cancel: vi.fn(),
  complete: vi.fn(),
  failure: vi.fn(),
  getOrThrow: vi.fn(),
  info: vi.fn(),
  middleware: vi.fn(),
  prisma: {
    $connect: vi.fn().mockResolvedValue(undefined),
    $disconnect: vi.fn().mockResolvedValue(undefined),
    analysis: { update: vi.fn() },
    generatedFix: { update: vi.fn() },
    pullRequestAnalysis: { update: vi.fn() },
  },
  publish: vi.fn(),
  resume: vi.fn(),
  startAttempt: vi.fn(),
  task: vi.fn((def: unknown) => def),
  wait: vi.fn(),
}));

vi.mock("@trigger.dev/sdk", () => ({
  locals: { create: vi.fn(), getOrThrow: mocks.getOrThrow, set: vi.fn() },
  task: mocks.task,
  tasks: {
    middleware: mocks.middleware,
    onCancel: mocks.cancel,
    onComplete: mocks.complete,
    onFailure: mocks.failure,
    onResume: mocks.resume,
    onStartAttempt: mocks.startAttempt,
    onWait: mocks.wait,
  },
}));

vi.mock("@/server/core/app-logger", () => ({
  appLogger: {
    debug: vi.fn(),
    error: vi.fn(),
    info: mocks.info,
    warn: vi.fn(),
  },
}));

vi.mock("@/server/core/db", () => ({
  prisma: mocks.prisma,
}));

vi.mock("@/server/core/realtime", () => ({
  realtimeService: {
    user: vi.fn(() => ({ publish: mocks.publish })),
  },
}));

import { REALTIME_CONFIG } from "@/shared/config/realtime";

import { getTaskPrisma } from "./init";

const middlewareHandler = mocks.middleware.mock.calls[0]?.[1];
const onWaitHandler = mocks.wait.mock.calls[0]?.[1];
const onResumeHandler = mocks.resume.mock.calls[0]?.[1];
const onStartAttemptHandler = mocks.startAttempt.mock.calls[0]?.[0];
const onCompleteHandler = mocks.complete.mock.calls[0]?.[0];
const onCancelHandler = mocks.cancel.mock.calls[0]?.[0];
const onFailureHandler = mocks.failure.mock.calls[0]?.[0];

describe("analysis/tasks:init lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getOrThrow.mockReturnValue(mocks.prisma);
  });

  it("getTaskPrisma returns the prisma instance from locals", () => {
    const prismaClient = getTaskPrisma();
    expect(prismaClient).toBe(mocks.prisma);
    expect(mocks.getOrThrow).toHaveBeenCalled();
  });

  describe("middleware and connection manager", () => {
    it("connects to database, calls next, and disconnects in finally block", async () => {
      const next = vi.fn().mockResolvedValue("next-ok");
      const ctx = { run: { id: "run-1" } };

      await middlewareHandler({ ctx, next });

      expect(mocks.prisma.$connect).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledTimes(1);
      expect(mocks.prisma.$disconnect).toHaveBeenCalledTimes(1);
    });

    it("disconnects database on onWait event", async () => {
      await onWaitHandler({ ctx: { run: { id: "run-1" } } });
      expect(mocks.prisma.$disconnect).toHaveBeenCalledTimes(1);
    });

    it("reconnects database on onResume event", async () => {
      await onResumeHandler({ ctx: { run: { id: "run-1" } } });
      expect(mocks.prisma.$connect).toHaveBeenCalledTimes(1);
    });

    it("logs start attempt on onStartAttempt", () => {
      onStartAttemptHandler({
        ctx: { attempt: { number: 2 }, run: { id: "run-2" }, task: { id: "analyze-repo" } },
      });
      expect(mocks.info).toHaveBeenCalledWith(
        expect.objectContaining({
          attempt: 2,
          task: "analyze-repo",
        }),
      );
    });
  });

  describe("onComplete failsafe", () => {
    it("returns early when task completes successfully", async () => {
      await onCompleteHandler({
        ctx: { task: { id: "analyze-repo" } },
        payload: { analysisId: "an-1" },
        result: { ok: true },
      });

      expect(mocks.prisma.analysis.update).not.toHaveBeenCalled();
    });

    it("resets analyze-repo status to FAILED and publishes realtime event on error", async () => {
      mocks.prisma.analysis.update.mockResolvedValue({ repo: { userId: 10 } });

      await onCompleteHandler({
        ctx: { task: { id: "analyze-repo" } },
        payload: { analysisId: "an-1" },
        result: { error: new Error("Analysis timeout"), ok: false },
      });

      expect(mocks.prisma.analysis.update).toHaveBeenCalledWith({
        data: { error: "Analysis timeout", status: "FAILED" },
        include: { repo: { select: { userId: true } } },
        where: { publicId: "an-1" },
      });
      expect(mocks.publish).toHaveBeenCalledWith(
        REALTIME_CONFIG.events.user.analysisProgress,
        expect.objectContaining({
          analysisId: "an-1",
          status: "FAILED",
        }),
      );
    });
  });

  describe("onCancel and onFailure failsafes", () => {
    it("handles onCancel and marks task state as failed", async () => {
      mocks.prisma.analysis.update.mockResolvedValue({ repo: { userId: 10 } });

      await onCancelHandler({
        ctx: { task: { id: "analyze-repo" } },
        payload: { analysisId: "an-2" },
      });

      expect(mocks.prisma.analysis.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            error: "Task execution manually cancelled on Trigger.dev Dashboard.",
            status: "FAILED",
          }),
          where: { publicId: "an-2" },
        }),
      );
    });

    it("handles onFailure and resets pullRequestAnalysis", async () => {
      await onFailureHandler({
        ctx: { task: { id: "analyze-pr" } },
        error: "PR analysis crash",
        payload: { analysisId: 99 },
      });

      expect(mocks.prisma.pullRequestAnalysis.update).toHaveBeenCalledWith({
        data: { error: "PR analysis crash", status: "FAILED" },
        where: { id: 99 },
      });
    });
  });
});
