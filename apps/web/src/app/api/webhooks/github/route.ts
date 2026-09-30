import { NextResponse } from "next/server";
import { type EmitterWebhookEvent, Webhooks } from "@octokit/webhooks";
import type { WebhookEventName } from "@octokit/webhooks/types";
import { Prisma } from "@prisma/client";

import { GITHUB_WEBHOOK_SECRET } from "@/shared/config/env.server";
import { REALTIME_CONFIG } from "@/shared/config/realtime";

import { appLogger } from "@/server/core/app-logger";
import { prisma } from "@/server/core/db";
import { realtimeService } from "@/server/core/realtime";
import { agentGithubReplyTask } from "@/server/modules/agent/tasks/agent-github-reply.task";
import { handlePullRequestEvent } from "@/server/modules/analysis/logic/pr-webhook-handler";
import { handleInstallationEvent } from "@/server/modules/webhooks/installation-webhook-handler";
import { handlePushEvent } from "@/server/modules/webhooks/push-webhook-handler";
import { handleRepositoryEvent } from "@/server/modules/webhooks/repository-webhook-handler";
import { AppError } from "@/server/utils/api-error";
import { buildRequestStore, requestContext } from "@/server/utils/request-context";
import { withApiHandler } from "@/server/utils/with-api-handler";

const webhooks = new Webhooks({
  secret: GITHUB_WEBHOOK_SECRET,
});

webhooks.on("installation", async ({ payload }) => {
  await handleInstallationEvent(payload);
});

webhooks.on("pull_request", async ({ payload }) => {
  await handlePullRequestEvent(payload);
});

webhooks.on("repository", async ({ payload }) => {
  await handleRepositoryEvent(payload);
});

webhooks.on("push", async ({ payload }) => {
  await handlePushEvent(payload);
});

webhooks.on("issue_comment.created", async ({ payload }) => {
  if (payload.sender.type === "Bot" && payload.sender.login === "doxynix[bot]") {
    return;
  }

  const repo = await prisma.repo.findFirst({
    where: { githubId: payload.repository.id },
  });

  if (repo == null) {
    return;
  }

  const prAnalysis = await prisma.pullRequestAnalysis.findFirst({
    select: { id: true },
    where: {
      prNumber: payload.issue.number,
      repoId: repo.id,
    },
  });

  if (prAnalysis == null) {
    appLogger.warn({
      msg: "Skipping GitHub comment sync: PullRequestAnalysis record not found in DB",
      prNumber: payload.issue.number,
      repoId: repo.id,
    });
    return;
  }

  const commentBody = payload.comment.body;

  const prComment = await prisma.pullRequestComment.create({
    data: {
      analysis: {
        connect: { id: prAnalysis.id },
      },
      body: commentBody,
      filePath: "PR_DISCUSSION",
      findingType: "GITHUB_USER_COMMENT",
      line: 0,
      riskLevel: 0,
    },
  });

  await realtimeService.user(repo.userId).publish(REALTIME_CONFIG.events.user.prCommentReceived, {
    author: payload.sender.login,
    authorAvatarUrl: payload.sender.avatar_url,
    commentId: prComment.id,
    prNumber: payload.issue.number,
    prTitle: payload.issue.title,
    repoName: payload.repository.name,
    repoOwner: payload.repository.owner.login,
  });

  if (commentBody.includes("@doxynix")) {
    await agentGithubReplyTask.trigger({
      branch: repo.defaultBranch,
      commentBody,
      commentId: payload.comment.id,
      commentType: "issue",
      owner: payload.repository.owner.login,
      prNumber: payload.issue.number,
      repoId: repo.id,
      repoName: payload.repository.name,
      userId: repo.userId,
    });
  }
});

webhooks.on("pull_request_review_comment", async ({ payload }) => {
  if (
    payload.action !== "created" ||
    (payload.sender.type === "Bot" && payload.sender.login === "doxynix[bot]")
  ) {
    return;
  }

  const commentBody = payload.comment.body;
  if (commentBody.includes("@doxynix")) {
    const repo = await prisma.repo.findFirst({
      where: { githubId: payload.repository.id },
    });

    if (repo == null) {
      return;
    }

    await agentGithubReplyTask.trigger({
      branch: repo.defaultBranch,
      commentBody,
      commentId: payload.comment.id,
      commentType: "review",
      owner: payload.repository.owner.login,
      prNumber: payload.pull_request.number,
      repoId: repo.id,
      repoName: payload.repository.name,
      userId: repo.userId,
    });
  }
});

async function handler(req: Request) {
  const payload = await req.text();
  const signature = req.headers.get("x-hub-signature-256") ?? "";
  const deliveryId = req.headers.get("x-github-delivery") ?? "";
  const githubEventHeader = req.headers.get("x-github-event");
  if (githubEventHeader == null) {
    throw new AppError({ code: "BAD_REQUEST", publicMessage: "Missing x-github-event" });
  }

  const githubEvent = githubEventHeader as WebhookEventName;

  if (deliveryId.length === 0) {
    throw new AppError({ code: "BAD_REQUEST", publicMessage: "Bad Request" });
  }

  if (!(await webhooks.verify(payload, signature))) {
    throw new AppError({ code: "UNAUTHORIZED", publicMessage: "Invalid signature" });
  }

  const store = buildRequestStore({
    method: "webhook",
    path: "/api/webhooks/github",
    req,
    requestId: deliveryId,
  });

  return requestContext.run(store, async () => {
    let delivery: null | { id: string } = null;

    try {
      delivery = await prisma.webhookDelivery.create({
        data: {
          deliveryId: deliveryId,
          event: githubEvent,
          provider: "github",
          status: "PROCESSING",
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const existing = await prisma.webhookDelivery.findUnique({
          where: { provider_deliveryId: { deliveryId, provider: "github" } },
        });

        if (existing == null) {
          return NextResponse.json(
            { error: { code: "CONFLICT", message: "Conflict error", requestId: deliveryId } },
            { status: 409 },
          );
        }

        if (existing.status === "SUCCESS") {
          return NextResponse.json({ msg: "Already processed", ok: true });
        }

        const isStale = Date.now() - existing.createdAt.getTime() > 5 * 60 * 1000;

        if (existing.status === "PROCESSING" && !isStale) {
          return NextResponse.json(
            {
              error: { code: "CONFLICT", message: "Processing in progress", requestId: deliveryId },
            },
            { status: 202 },
          );
        }

        delivery = await prisma.webhookDelivery.update({
          data: { error: null, status: "PROCESSING" },
          where: { id: existing.id },
        });
      } else {
        throw new AppError({
          cause: error,
          code: "INTERNAL_SERVER_ERROR",
          publicMessage: "DB Error",
          unexpected: true,
        });
      }
    }

    try {
      const eventToReceive = {
        id: deliveryId,
        name: githubEvent,
        payload: JSON.parse(payload),
      } as EmitterWebhookEvent;

      await webhooks.receive(eventToReceive);

      await prisma.webhookDelivery.update({
        data: { status: "SUCCESS" },
        where: { id: delivery.id },
      });

      return NextResponse.json({ ok: true });
    } catch (error) {
      appLogger.error({ error, msg: "Webhook processing failed" });

      await prisma.webhookDelivery.update({
        data: {
          error: error instanceof Error ? error.message : String(error),
          status: "FAILED",
        },
        where: { id: delivery.id },
      });

      throw new AppError({
        cause: error,
        code: "INTERNAL_SERVER_ERROR",
        publicMessage: "Internal Error",
        unexpected: true,
      });
    }
  });
}

/**
 * The `requestContext` store built above is keyed on the GitHub delivery id, so
 * the wrapper reuses it instead of minting a fresh UUID — every log line and
 * the `requestId` in the response point at the same delivery.
 */
export const POST = withApiHandler(handler, { scope: "webhooks/github" });
