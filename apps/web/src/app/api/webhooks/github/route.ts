import { NextResponse } from "next/server";
import { type EmitterWebhookEvent, Webhooks } from "@octokit/webhooks";
import type { WebhookEventName } from "@octokit/webhooks/types";
import { Prisma } from "@prisma/client";

import { GITHUB_WEBHOOK_SECRET } from "@/shared/config/env.server";

import { AppError } from "@/server/core/api-error";
import { appLogger } from "@/server/core/app-logger";
import { prisma } from "@/server/core/db";
import { agentGithubReplyTask } from "@/server/modules/agent/tasks/agent-github-reply.task";
import { handlePullRequestEvent } from "@/server/modules/analysis/logic/pr-webhook-handler";
import { handleInstallationEvent } from "@/server/modules/webhooks/installation-webhook-handler";
import { handleIssueCommentEvent } from "@/server/modules/webhooks/issue-comment-webhook-handler";
import { handlePushEvent } from "@/server/modules/webhooks/push-webhook-handler";
import { handleRepositoryEvent } from "@/server/modules/webhooks/repository-webhook-handler";
import { handleReviewCommentEvent } from "@/server/modules/webhooks/review-comment-webhook-handler";
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
  const mention = await handleIssueCommentEvent(payload);
  if (mention != null) {
    await agentGithubReplyTask.trigger(mention);
  }
});

webhooks.on("pull_request_review_comment", async ({ payload }) => {
  const mention = await handleReviewCommentEvent(payload);
  if (mention != null) {
    await agentGithubReplyTask.trigger(mention);
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

// The store above is keyed on the GitHub delivery id, so the wrapper reuses it instead of minting a UUID.
export const POST = withApiHandler(handler, { scope: "webhooks/github" });
