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
      if (action === "created") {
        const senderId = event.sender?.id;
        let matchedUserId: number | null = null;

        if (senderId != null) {
          const account = await prisma.account.findFirst({
            where: { provider: "github", providerAccountId: String(senderId) },
          });
          if (account != null) matchedUserId = account.userId;
        }

        await prisma.githubInstallation.upsert({
          create: {
            accountAvatar: event.installation.account.avatar_url,
            accountLogin: event.installation.account.login,
            appId: event.installation.app_id,
            id: instIdBigInt,
            repositorySelection: event.installation.repository_selection,
            targetId: BigInt(event.installation.target_id || event.installation.account.id),
            targetType: event.installation.target_type,
            userId: matchedUserId,
          },
          update: {
            accountAvatar: event.installation.account.avatar_url,
            accountLogin: event.installation.account.login,
            repositorySelection: event.installation.repository_selection,
            ...(matchedUserId != null ? { userId: matchedUserId } : {}),
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
        const [result] = await prisma.$transaction([
          prisma.githubInstallation.deleteMany({
            where: { id: instIdBigInt },
          }),
          prisma.auditLog.create({
            data: {
              model: "GithubInstallation",
              operation: `GITHUB_INSTALLATION_DELETED`,
              payload: { githubLogin, installationId: event.installation.id },
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
        logger.info({
          installationId: event.installation.id,
          msg: "GitHub installation suspended",
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
      return new NextResponse("DB Error", { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}
