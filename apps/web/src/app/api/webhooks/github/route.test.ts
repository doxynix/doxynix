import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/webhooks/github/route";
import { prisma } from "@/server/core/db";
import { realtimeService } from "@/server/core/realtime";
import { agentGithubReplyTask } from "@/server/modules/agent/tasks/agent-github-reply.task";
import { handlePushEvent } from "@/server/modules/webhooks/push-webhook-handler";

const { mockAppLogger, webhookHandlers, webhooksVerifyMock } = vi.hoisted(() => ({
  mockAppLogger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
  webhookHandlers: new Map<string, Array<(event: never) => Promise<void>>>(),
  webhooksVerifyMock: vi.fn(),
}));

vi.mock("@octokit/webhooks", () => {
  class Webhooks {
    on(event: string, cb: (event: never) => Promise<void>) {
      const list = webhookHandlers.get(event) ?? [];
      list.push(cb);
      webhookHandlers.set(event, list);
    }
    verify = webhooksVerifyMock;
    async receive(event: { id: string; name: string; payload: unknown }) {
      const list = webhookHandlers.get(event.name) ?? [];
      for (const cb of list) {
        await cb({ id: event.id, name: event.name, payload: event.payload } as never);
      }
    }
  }
  return { Webhooks };
});

vi.mock("@/server/core/app-logger", () => ({ appLogger: mockAppLogger }));

vi.mock("@/server/core/db", () => ({
  prisma: {
    pullRequestAnalysis: { findFirst: vi.fn() },
    pullRequestComment: { create: vi.fn() },
    repo: { findFirst: vi.fn() },
    webhookDelivery: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  },
}));

vi.mock("@/server/core/realtime", () => ({
  realtimeService: { user: vi.fn(() => ({ publish: vi.fn() })) },
}));

vi.mock("@/server/modules/agent/tasks/agent-github-reply.task", () => ({
  agentGithubReplyTask: { trigger: vi.fn() },
}));

vi.mock("@/server/modules/analysis/logic/pr-webhook-handler", () => ({
  handlePullRequestEvent: vi.fn(),
}));

vi.mock("@/server/modules/webhooks/installation-webhook-handler", () => ({
  handleInstallationEvent: vi.fn(),
}));

vi.mock("@/server/modules/webhooks/push-webhook-handler", () => ({
  handlePushEvent: vi.fn(),
}));

vi.mock("@/server/modules/webhooks/repository-webhook-handler", () => ({
  handleRepositoryEvent: vi.fn(),
}));

const p2002 = () =>
  new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    clientVersion: "6.19.3",
    code: "P2002",
  });

const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

const baseHeaders = (overrides: Record<string, string> = {}) => ({
  "x-github-delivery": "delivery-1",
  "x-github-event": "push",
  "x-hub-signature-256": "sha256=abc",
  ...overrides,
});

const makeReq = (payload: string, headers: Record<string, string>) =>
  new Request("http://localhost/api/webhooks/github", {
    body: payload,
    headers,
    method: "POST",
  });

const pushPayload = JSON.stringify({ ref: "refs/heads/main" });

describe("POST /api/webhooks/github", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    webhooksVerifyMock.mockResolvedValue(true);
  });

  it("returns 400 when x-github-event is missing", async () => {
    const headers = {
      "x-github-delivery": "delivery-1",
      "x-hub-signature-256": "sha256=abc",
    };
    const res = await POST(makeReq(pushPayload, headers));
    expect(res.status).toBe(400);
    await expect(res.text()).resolves.toBe("Bad Request: Missing x-github-event");
  });

  it("returns 400 when x-github-delivery is missing", async () => {
    const headers = {
      "x-github-event": "push",
      "x-hub-signature-256": "sha256=abc",
    };
    const res = await POST(makeReq(pushPayload, headers));
    expect(res.status).toBe(400);
    await expect(res.text()).resolves.toBe("Bad Request");
  });

  it("returns 401 when the signature is invalid", async () => {
    webhooksVerifyMock.mockResolvedValue(false);
    vi.mocked(prisma.webhookDelivery.create).mockResolvedValue({ id: "d1" } as never);
    const res = await POST(makeReq(pushPayload, baseHeaders()));
    expect(res.status).toBe(401);
    await expect(res.text()).resolves.toBe("Invalid signature");
  });

  it("stores a delivery and returns ok on the happy path", async () => {
    vi.mocked(prisma.webhookDelivery.create).mockResolvedValue({ id: "d1" } as never);
    vi.mocked(prisma.webhookDelivery.update).mockResolvedValue({ id: "d1" } as never);

    const res = await POST(makeReq(pushPayload, baseHeaders()));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
    expect(prisma.webhookDelivery.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          deliveryId: "delivery-1",
          event: "push",
          status: "PROCESSING",
        }),
      }),
    );
    expect(prisma.webhookDelivery.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "SUCCESS" } }),
    );
  });

  it("returns 409 when dedupe finds no existing delivery", async () => {
    vi.mocked(prisma.webhookDelivery.create).mockRejectedValue(p2002());
    vi.mocked(prisma.webhookDelivery.findUnique).mockResolvedValue(null);

    const res = await POST(makeReq(pushPayload, baseHeaders()));

    expect(res.status).toBe(409);
    await expect(res.text()).resolves.toBe("Conflict error");
  });

  it("returns already-processed when the existing delivery is SUCCESS", async () => {
    vi.mocked(prisma.webhookDelivery.create).mockRejectedValue(p2002());
    vi.mocked(prisma.webhookDelivery.findUnique).mockResolvedValue({
      createdAt: new Date(),
      id: "d1",
      status: "SUCCESS",
    } as never);

    const res = await POST(makeReq(pushPayload, baseHeaders()));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ msg: "Already processed", ok: true });
    expect(prisma.webhookDelivery.update).not.toHaveBeenCalled();
  });

  it("returns 202 while a fresh delivery is still PROCESSING", async () => {
    vi.mocked(prisma.webhookDelivery.create).mockRejectedValue(p2002());
    vi.mocked(prisma.webhookDelivery.findUnique).mockResolvedValue({
      createdAt: new Date(),
      id: "d1",
      status: "PROCESSING",
    } as never);

    const res = await POST(makeReq(pushPayload, baseHeaders()));

    expect(res.status).toBe(202);
    await expect(res.text()).resolves.toBe("Processing in progress");
  });

  it("retries a stale PROCESSING delivery", async () => {
    vi.mocked(prisma.webhookDelivery.create).mockRejectedValue(p2002());
    vi.mocked(prisma.webhookDelivery.findUnique).mockResolvedValue({
      createdAt: tenMinutesAgo,
      id: "d1",
      status: "PROCESSING",
    } as never);
    vi.mocked(prisma.webhookDelivery.update).mockResolvedValue({ id: "d1" } as never);

    const res = await POST(makeReq(pushPayload, baseHeaders()));

    expect(res.status).toBe(200);
    expect(prisma.webhookDelivery.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { error: null, status: "PROCESSING" } }),
    );
  });

  it("retries a FAILED delivery", async () => {
    vi.mocked(prisma.webhookDelivery.create).mockRejectedValue(p2002());
    vi.mocked(prisma.webhookDelivery.findUnique).mockResolvedValue({
      createdAt: new Date(),
      id: "d1",
      status: "FAILED",
    } as never);
    vi.mocked(prisma.webhookDelivery.update).mockResolvedValue({ id: "d1" } as never);

    const res = await POST(makeReq(pushPayload, baseHeaders()));

    expect(res.status).toBe(200);
    expect(prisma.webhookDelivery.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { error: null, status: "PROCESSING" } }),
    );
  });

  it("returns 500 on a non-dedupe DB error", async () => {
    vi.mocked(prisma.webhookDelivery.create).mockRejectedValue(new Error("db down"));

    const res = await POST(makeReq(pushPayload, baseHeaders()));

    expect(res.status).toBe(500);
    await expect(res.text()).resolves.toBe("DB Error");
  });

  it("returns 500 and marks the delivery FAILED when receive throws", async () => {
    vi.mocked(prisma.webhookDelivery.create).mockResolvedValue({ id: "d1" } as never);
    vi.mocked(prisma.webhookDelivery.update).mockResolvedValue({ id: "d1" } as never);
    vi.mocked(handlePushEvent).mockRejectedValue(new Error("handler boom"));

    const res = await POST(makeReq(pushPayload, baseHeaders()));

    expect(res.status).toBe(500);
    await expect(res.text()).resolves.toBe("Internal Error");
    expect(prisma.webhookDelivery.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "FAILED" }) }),
    );
  });

  it("skips issue_comment.created when the sender is the doxynix bot", async () => {
    const handler = webhookHandlers.get("issue_comment.created")?.[0];
    expect(handler).toBeDefined();
    const payload = {
      repository: { id: 123 },
      sender: { login: "doxynix[bot]", type: "Bot" },
    };
    await handler!({ payload } as never);
    expect(prisma.repo.findFirst).not.toHaveBeenCalled();
    expect(agentGithubReplyTask.trigger).not.toHaveBeenCalled();
  });

  it("skips issue_comment.created when the repo is not found", async () => {
    vi.mocked(prisma.repo.findFirst).mockResolvedValue(null);
    const handler = webhookHandlers.get("issue_comment.created")?.[0];
    const payload = {
      comment: { body: "hello @doxynix" },
      repository: { id: 123 },
      sender: { login: "octocat", type: "User" },
    };
    await handler!({ payload } as never);
    expect(prisma.pullRequestAnalysis.findFirst).not.toHaveBeenCalled();
    expect(agentGithubReplyTask.trigger).not.toHaveBeenCalled();
  });

  it("stores a user comment and triggers the agent when mentioned", async () => {
    vi.mocked(prisma.repo.findFirst).mockResolvedValue({
      defaultBranch: "main",
      id: 42,
      publicId: "pub-1",
      userId: 7,
    } as never);
    vi.mocked(prisma.pullRequestAnalysis.findFirst).mockResolvedValue({ id: "ana-1" } as never);
    vi.mocked(prisma.pullRequestComment.create).mockResolvedValue({ publicId: "c-1" } as never);

    const handler = webhookHandlers.get("issue_comment.created")?.[0];
    const payload = {
      comment: { body: "Hey @doxynix look at this", id: 999 },
      issue: { number: 42, title: "PR title" },
      repository: { id: 123, name: "repo", owner: { login: "owner" } },
      sender: { avatar_url: "https://a", login: "octocat", type: "User" },
    };

    await handler!({ payload } as never);

    expect(prisma.pullRequestComment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          body: "Hey @doxynix look at this",
          findingType: "GITHUB_USER_COMMENT",
          line: 0,
        }),
      }),
    );
    expect(realtimeService.user).toHaveBeenCalledWith(7);
    expect(agentGithubReplyTask.trigger).toHaveBeenCalledWith(
      expect.objectContaining({
        commentType: "issue",
        prNumber: 42,
        repoId: "pub-1",
        userId: 7,
      }),
    );
  });

  it("does not trigger the agent when the comment has no @doxynix mention", async () => {
    vi.mocked(prisma.repo.findFirst).mockResolvedValue({
      defaultBranch: "main",
      id: 42,
      publicId: "pub-1",
      userId: 7,
    } as never);
    vi.mocked(prisma.pullRequestAnalysis.findFirst).mockResolvedValue({ id: "ana-1" } as never);
    vi.mocked(prisma.pullRequestComment.create).mockResolvedValue({ publicId: "c-1" } as never);

    const handler = webhookHandlers.get("issue_comment.created")?.[0];
    const payload = {
      comment: { body: "Just a comment", id: 999 },
      issue: { number: 42, title: "PR title" },
      repository: { id: 123, name: "repo", owner: { login: "owner" } },
      sender: { avatar_url: "https://a", login: "octocat", type: "User" },
    };

    await handler!({ payload } as never);

    expect(prisma.pullRequestComment.create).toHaveBeenCalledTimes(1);
    expect(agentGithubReplyTask.trigger).not.toHaveBeenCalled();
  });

  it("skips pull_request_review_comment when action is not created", async () => {
    const handler = webhookHandlers.get("pull_request_review_comment")?.[0];
    expect(handler).toBeDefined();
    const payload = {
      action: "edited",
      comment: { body: "hello @doxynix" },
      sender: { login: "octocat", type: "User" },
    };
    await handler!({ payload } as never);
    expect(agentGithubReplyTask.trigger).not.toHaveBeenCalled();
  });

  it("triggers the agent for pull_request_review_comment with @doxynix", async () => {
    vi.mocked(prisma.repo.findFirst).mockResolvedValue({
      defaultBranch: "main",
      id: 42,
      publicId: "pub-1",
      userId: 7,
    } as never);

    const handler = webhookHandlers.get("pull_request_review_comment")?.[0];
    const payload = {
      action: "created",
      comment: { body: "review comment @doxynix", id: 999 },
      pull_request: { number: 42 },
      repository: { id: 123, name: "repo", owner: { login: "owner" } },
      sender: { login: "octocat", type: "User" },
    };

    await handler!({ payload } as never);

    expect(agentGithubReplyTask.trigger).toHaveBeenCalledWith(
      expect.objectContaining({
        commentId: 999,
        commentType: "review",
        prNumber: 42,
      }),
    );
  });

  it("skips pull_request_review_comment when the repo is not found", async () => {
    vi.mocked(prisma.repo.findFirst).mockResolvedValue(null);
    const handler = webhookHandlers.get("pull_request_review_comment")?.[0];
    const payload = {
      action: "created",
      comment: { body: "review comment @doxynix", id: 999 },
      pull_request: { number: 42 },
      repository: { id: 123 },
      sender: { login: "octocat", type: "User" },
    };
    await handler!({ payload } as never);
    expect(agentGithubReplyTask.trigger).not.toHaveBeenCalled();
  });
});
