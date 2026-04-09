import crypto from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";

import { GITHUB_WEBHOOK_SECRET } from "@/shared/constants/env.server";

import { prisma } from "@/server/shared/infrastructure/db";
import { logger } from "@/server/shared/infrastructure/logger";
import { buildRequestStore, requestContext } from "@/server/shared/lib/request-context";

type GitHubWebhookEvent = {
  action?: string;
  installation?: {
    account: {
      avatar_url?: string;
      id: number;
      login: string;
    };
    app_id: number;
    html_url: string;
    id: number;
    repository_selection: string;
    target_id: number;
    target_type: string;
  };
  sender?: {
    id: number;
    login: string;
  };
};

export async function POST(req: Request) {
  const payload = await req.text();
  const signature = req.headers.get("x-hub-signature-256") ?? "";
  const deliveryId = req.headers.get("x-github-delivery") ?? "";

  if (deliveryId.length === 0) {
    return new NextResponse("Missing x-github-delivery", { status: 400 });
  }

  const hmac = crypto.createHmac("sha256", GITHUB_WEBHOOK_SECRET);
  const digest = "sha256=" + hmac.update(payload).digest("hex");
  const signatureBuffer = Buffer.from(signature);
  const digestBuffer = Buffer.from(digest);

  if (
    signatureBuffer.length !== digestBuffer.length ||
    !crypto.timingSafeEqual(signatureBuffer, digestBuffer)
  ) {
    return new NextResponse("Invalid signature", { status: 401 });
  }

  let event: GitHubWebhookEvent;
  try {
    event = JSON.parse(payload) as GitHubWebhookEvent;
  } catch {
    return new NextResponse("Invalid JSON", { status: 400 });
  }

  const action = event.action;
  const githubEvent = req.headers.get("x-github-event");

  const store = buildRequestStore({
    method: "webhook",
    path: "/api/webhooks/github",
    req: req as NextRequest,
    requestId: deliveryId,
  });

  return await requestContext.run(store, async () => {
    try {
      await prisma.webhookDelivery.create({
        data: {
          deliveryId: deliveryId,
          event: githubEvent ?? null,
          provider: "github",
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        logger.info({ deliveryId, msg: "Webhook already processed, skipping" });
        return NextResponse.json({ ok: true });
      }
      logger.error({ error, msg: "Webhook dedupe write failed" });
      return new NextResponse("DB Error", { status: 500 });
    }

    if (githubEvent === "installation" && event.installation?.id != null) {
      const instIdBigInt = BigInt(event.installation.id);
      const rawLogin = event.installation.account.login;
      if (typeof rawLogin !== "string") {
        console.warn("Invalid GitHub webhook payload: missing account.login", event);
        return new Response("Bad Request", { status: 400 });
      }
      const githubLogin = rawLogin.slice(0, 39);
      const githubAvatar = event.installation.account.avatar_url;
      const githubRepoSelection = event.installation.repository_selection;
      const githubHtmlUrl = event.installation.html_url;

      try {
        if (action === "created") {
          const matchedUserId: number | null = null;

          await prisma.githubInstallation.upsert({
            create: {
              accountAvatar: githubAvatar,
              accountLogin: githubLogin,
              appId: event.installation.app_id,
              htmlUrl: githubHtmlUrl,
              id: instIdBigInt,
              repositorySelection: githubRepoSelection,
              targetId: BigInt(event.installation.target_id || event.installation.account.id),
              targetType: event.installation.target_type,
              userId: matchedUserId,
            },
            update: {
              accountAvatar: githubAvatar,
              accountLogin: githubLogin,
              htmlUrl: githubHtmlUrl,
              isSuspended: false,
              repositorySelection: githubRepoSelection,
            },
            where: { id: instIdBigInt },
          });
          logger.info({
            installationId: event.installation.id,
            matchedUserId,
            msg: "GitHub installation created via webhook",
          });
        }

        if (action === "deleted") {
          const result = await prisma.githubInstallation.deleteMany({
            where: { id: instIdBigInt },
          });

          logger.info({
            affectedRows: result.count,
            installationId: event.installation.id,
            msg: "GitHub installation deleted via webhook",
          });
        }

        if (action === "suspend") {
          await prisma.githubInstallation.updateMany({
            data: { isSuspended: true },
            where: { id: instIdBigInt },
          });
          logger.info({
            installationId: event.installation.id,
            msg: "GitHub installation suspended",
          });
        }

        if (action === "unsuspend") {
          await prisma.githubInstallation.updateMany({
            data: { isSuspended: false },
            where: { id: instIdBigInt },
          });
          logger.info({
            installationId: event.installation.id,
            msg: "GitHub installation unsuspended",
          });
        }

        if (action === "new_permissions_accepted") {
          logger.info({
            installationId: event.installation.id,
            msg: "GitHub App permissions updated by user",
          });
        }
      } catch (error) {
        logger.error({ error, msg: "Webhook DB Processing Error" });
        try {
          await prisma.webhookDelivery.deleteMany({
            where: {
              deliveryId,
              provider: "github",
            },
          });
        } catch (cleanupError) {
          logger.error({ error: cleanupError, msg: "Webhook dedupe cleanup failed" });
        }
        return new NextResponse("DB Error", { status: 500 });
      }
    }

    return NextResponse.json({ ok: true });
  });
}
