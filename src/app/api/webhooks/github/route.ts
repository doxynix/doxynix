import { NextResponse, type NextRequest } from "next/server";
import { Webhooks, type EmitterWebhookEvent } from "@octokit/webhooks";
import type {
  InstallationEvent,
  PullRequestEvent,
  PushEvent,
  RepositoryEvent,
  WebhookEventName,
} from "@octokit/webhooks-types";
import { Prisma } from "@prisma/client";

import { GITHUB_WEBHOOK_SECRET } from "@/shared/constants/env.server";

import { handleInstallationEvent } from "@/server/features/github-webhooks/lib/installation-webhook-handler";
import { handlePushEvent } from "@/server/features/github-webhooks/lib/push-webhook-handler";
import { handleRepositoryEvent } from "@/server/features/github-webhooks/lib/repository-webhook-handler";
import { handlePullRequestEvent } from "@/server/features/pr-analysis/lib/pr-webhook-handler";
import { prisma } from "@/server/shared/infrastructure/db";
import { logger } from "@/server/shared/infrastructure/logger";
import { buildRequestStore, requestContext } from "@/server/shared/lib/request-context";

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

  return await requestContext.run(store, async () => {
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
        logger.error({ error, msg: "Webhook dedupe database error" });
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
      logger.error({ error, msg: "Webhook processing failed" });

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
