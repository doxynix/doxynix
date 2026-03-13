import crypto from "node:crypto";
import { NextResponse } from "next/server";

import { GITHUB_WEBHOOK_SECRET } from "@/shared/constants/env.server";

import { prisma } from "@/server/db/db";
import { logger } from "@/server/logger/logger";

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

  if (githubEvent === "installation" && event.installation?.id != null) {
    const instIdBigInt = BigInt(event.installation.id);
    const githubLogin = event.installation.account.login;

    try {
      const existingLog = await prisma.auditLog.findFirst({
        where: { model: "GithubInstallation", requestId: deliveryId },
      });

      if (existingLog != null) {
        logger.info({ deliveryId, msg: "Webhook already processed, skipping" });
        return NextResponse.json({ ok: true });
      }

      if (action === "created") {
        const senderId = event.sender?.id;
        let matchedUserId: number | null = null;

        if (senderId != null) {
          const account = await prisma.account.findFirst({
            where: { provider: "github", providerAccountId: String(senderId) },
          });
          if (account != null) matchedUserId = account.userId;
        }

        await prisma.$transaction([
          prisma.githubInstallation.upsert({
            create: {
              accountAvatar: event.installation.account.avatar_url,
              accountLogin: event.installation.account.login,
              appId: event.installation.app_id,
              htmlUrl: event.installation.html_url,
              id: instIdBigInt,
              repositorySelection: event.installation.repository_selection,
              targetId: BigInt(event.installation.target_id || event.installation.account.id),
              targetType: event.installation.target_type,
              userId: matchedUserId,
            },
            update: {
              accountAvatar: event.installation.account.avatar_url,
              accountLogin: event.installation.account.login,
              htmlUrl: event.installation.html_url,
              isSuspended: false,
              repositorySelection: event.installation.repository_selection,
            },
            where: { id: instIdBigInt },
          }),
          prisma.auditLog.create({
            data: {
              model: "GithubInstallation",
              operation: `GITHUB_APP_INSTALLED`,
              payload: { githubLogin, installationId: event.installation!.id },
              requestId: deliveryId,
              userId: matchedUserId,
            },
          }),
        ]);
        logger.info({
          installationId: event.installation.id,
          matchedUserId,
          msg: "GitHub installation created via webhook",
        });
      }

      if (action === "deleted") {
        const [result] = await prisma.$transaction([
          prisma.githubInstallation.deleteMany({ where: { id: instIdBigInt } }),
          prisma.auditLog.create({
            data: {
              model: "GithubInstallation",
              operation: `GITHUB_APP_DELETED`,
              payload: { githubLogin, installationId: event.installation.id },
              requestId: deliveryId,
            },
          }),
        ]);

        logger.info({
          affectedRows: result.count,
          installationId: event.installation.id,
          msg: "GitHub installation deleted via webhook",
        });
      }

      if (action === "suspend") {
        await prisma.$transaction([
          prisma.githubInstallation.updateMany({
            data: { isSuspended: true },
            where: { id: instIdBigInt },
          }),
          prisma.auditLog.create({
            data: {
              model: "GithubInstallation",
              operation: `GITHUB_APP_SUSPENDED`,
              payload: { githubLogin, installationId: event.installation.id },
              requestId: deliveryId,
            },
          }),
        ]);
        logger.info({
          installationId: event.installation.id,
          msg: "GitHub installation suspended",
        });
      }

      if (action === "unsuspend") {
        await prisma.$transaction([
          prisma.githubInstallation.updateMany({
            data: { isSuspended: false },
            where: { id: instIdBigInt },
          }),
          prisma.auditLog.create({
            data: {
              model: "GithubInstallation",
              operation: `GITHUB_APP_UNSUSPENDED`,
              payload: { githubLogin, installationId: event.installation.id },
              requestId: deliveryId,
            },
          }),
        ]);
        logger.info({
          installationId: event.installation.id,
          msg: "GitHub installation unsuspended",
        });
      }

      if (action === "new_permissions_accepted") {
        await prisma.auditLog.create({
          data: {
            model: "GithubInstallation",
            operation: `GITHUB_APP_PERMISSIONS_UPDATED`,
            payload: { githubLogin, installationId: event.installation.id },
            requestId: deliveryId,
          },
        });
        logger.info({
          installationId: event.installation.id,
          msg: "GitHub App permissions updated by user",
        });
      }
    } catch (error) {
      logger.error({ error, msg: "Webhook DB Processing Error" });
      return new NextResponse("DB Error", { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}
