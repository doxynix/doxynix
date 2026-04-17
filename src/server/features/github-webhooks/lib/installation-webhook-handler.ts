import type { InstallationEvent } from "@octokit/webhooks-types";

import { prisma } from "@/server/shared/infrastructure/db";
import { logger } from "@/server/shared/infrastructure/logger";

export async function handleInstallationEvent(payload: InstallationEvent): Promise<void> {
  const action = payload.action;
  const installation = payload.installation;
  const instIdBigInt = BigInt(installation.id);

  const githubLogin = installation.account.login.slice(0, 39);
  const githubAvatar = installation.account.avatar_url;
  const githubRepoSelection = installation.repository_selection;
  const githubHtmlUrl = installation.html_url;

  try {
    if (action === "created") {
      await prisma.githubInstallation.upsert({
        create: {
          accountAvatar: githubAvatar,
          accountLogin: githubLogin,
          appId: installation.app_id,
          htmlUrl: githubHtmlUrl,
          id: instIdBigInt,
          repositorySelection: githubRepoSelection,
          targetId: BigInt(installation.target_id),
          targetType: installation.target_type,
          userId: null,
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
        installationId: instIdBigInt.toString(),
        msg: "GitHub installation created via webhook",
      });
    }

    if (action === "deleted") {
      const result = await prisma.githubInstallation.deleteMany({ where: { id: instIdBigInt } });
      logger.info({
        affectedRows: result.count,
        installationId: instIdBigInt.toString(),
        msg: "GitHub installation deleted via webhook",
      });
    }

    if (action === "suspend") {
      await prisma.githubInstallation.updateMany({
        data: { isSuspended: true },
        where: { id: instIdBigInt },
      });
      logger.info({
        installationId: instIdBigInt.toString(),
        msg: "GitHub installation suspended",
      });
    }

    if (action === "unsuspend") {
      await prisma.githubInstallation.updateMany({
        data: { isSuspended: false },
        where: { id: instIdBigInt },
      });
      logger.info({
        installationId: instIdBigInt.toString(),
        msg: "GitHub installation unsuspended",
      });
    }

    if (action === "new_permissions_accepted") {
      logger.info({
        installationId: instIdBigInt.toString(),
        msg: "GitHub App permissions updated by user",
      });
    }
  } catch (error) {
    logger.error({ error, msg: "Webhook DB Processing Error" });
    throw error;
  }
}
