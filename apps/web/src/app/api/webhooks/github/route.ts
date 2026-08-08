import { NextResponse, type NextRequest } from "next/server";
import { Webhooks, type EmitterWebhookEvent } from "@octokit/webhooks";
import type {
  InstallationEvent,
  PullRequestEvent,
  PullRequestReviewCommentEvent,
  PushEvent,
  RepositoryEvent,
  WebhookEventName,
} from "@octokit/webhooks-types";
import { Prisma } from "@prisma/client";

import { GITHUB_WEBHOOK_SECRET } from "@/shared/constants/env.server";
import { REALTIME_CONFIG } from "@/shared/constants/realtime";

import { appLogger } from "@/server/core/app-logger";
import { prisma } from "@/server/core/db";
import { realtimeServer } from "@/server/core/realtime";
import { agentGithubReplyTask } from "@/server/modules/agent/tasks/agent-github-reply.task";
import { handlePullRequestEvent } from "@/server/modules/analysis/logic/pr-webhook-handler";
import { handleInstallationEvent } from "@/server/modules/webhooks/installation-webhook-handler";
import { handlePushEvent } from "@/server/modules/webhooks/push-webhook-handler";
import { handleRepositoryEvent } from "@/server/modules/webhooks/repository-webhook-handler";
import { buildRequestStore, requestContext } from "@/server/utils/request-context";

const webhooks = new Webhooks({
  secret: GITHUB_WEBHOOK_SECRET,
});

webhooks.on("installation", async ({ payload }) => {
  await handleInstallationEvent(payload as InstallationEvent);
});

webhooks.on("pull_request", async ({ payload }) => {
  await handlePullRequestEvent(payload as PullRequestEvent);
});

webhooks.on("repository", async ({ payload }) => {
  await handleRepositoryEvent(payload as RepositoryEvent);
});

webhooks.on("push", async ({ payload }) => {
  await handlePushEvent(payload as PushEvent);
});

webhooks.on("issue_comment.created", async ({ payload }) => {
  if (payload.sender.type === "Bot" && payload.sender.login === "doxynix[bot]") return;

  const repo = await prisma.repo.findFirst({
    where: { githubId: payload.repository.id },
  });

  if (repo == null) return;

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

  const channelName = REALTIME_CONFIG.channels.user(String(repo.userId));
  await realtimeServer.channels
    .get(channelName)
    .publish(REALTIME_CONFIG.events.user.prCommentReceived, {
      author: payload.sender.login,
      authorAvatarUrl: payload.sender.avatar_url,
      commentId: prComment.publicId,
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
      repoId: repo.publicId,
      repoName: payload.repository.name,
      userId: Number(repo.userId),
    });
  }
});

webhooks.on("pull_request_review_comment", async ({ payload }) => {
  const commentPayload = payload as PullRequestReviewCommentEvent;
  if (
    commentPayload.action !== "created" ||
    (commentPayload.sender.type === "Bot" && commentPayload.sender.login === "doxynix[bot]")
  )
    return;

  const commentBody = commentPayload.comment.body;
  if (commentBody.includes("@doxynix")) {
    const repo = await prisma.repo.findFirst({
      where: { githubId: commentPayload.repository.id },
    });

    if (repo == null) return;

    await agentGithubReplyTask.trigger({
      branch: repo.defaultBranch,
      commentBody,
      commentId: commentPayload.comment.id,
      commentType: "review",
      owner: commentPayload.repository.owner.login,
      prNumber: commentPayload.pull_request.number,
      repoId: repo.publicId,
      repoName: commentPayload.repository.name,
      userId: Number(repo.userId),
    });
  }
});

export async function POST(req: Request) {
  const payload = await req.text();
  const signature = req.headers.get("x-hub-signature-256") ?? "";
  const deliveryId = req.headers.get("x-github-delivery") ?? "";
  const githubEventHeader = req.headers.get("x-github-event");
  if (githubEventHeader == null) {
    return new NextResponse("Bad Request: Missing x-github-event", { status: 400 });
  }

  const githubEvent = githubEventHeader as WebhookEventName;

  if (deliveryId.length === 0) {
    return new NextResponse("Bad Request", { status: 400 });
  }

  if (!Boolean(await webhooks.verify(payload, signature))) {
    return new NextResponse("Invalid signature", { status: 401 });
  }

  const store = buildRequestStore({
    method: "webhook",
    path: "/api/webhooks/github",
    req: req as NextRequest,
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
          return new NextResponse("Conflict error", { status: 409 });
        }

        if (existing.status === "SUCCESS") {
          return NextResponse.json({ msg: "Already processed", ok: true });
        }

        const isStale = Date.now() - existing.createdAt.getTime() > 5 * 60 * 1000;

        if (existing.status === "PROCESSING" && !isStale) {
          return new NextResponse("Processing in progress", { status: 202 });
        }

        delivery = await prisma.webhookDelivery.update({
          data: { error: null, status: "PROCESSING" },
          where: { id: existing.id },
        });
      } else {
        appLogger.error({ error, msg: "Webhook dedupe database error" });
        return new NextResponse("DB Error", { status: 500 });
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

      return new NextResponse("Internal Error", { status: 500 });
    }
  });
}
