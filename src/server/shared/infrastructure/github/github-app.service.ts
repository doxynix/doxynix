import crypto from "node:crypto";
import type { InstallationTargetType, RepositorySelection } from "@prisma/client";
import { TRPCError } from "@trpc/server";

import type { DbClient, PrismaClientExtended } from "@/server/shared/infrastructure/db";
import { getMyRepos } from "@/server/shared/infrastructure/github/github-api";
import {
  getInstallationInfo,
  getUserClient,
} from "@/server/shared/infrastructure/github/github-provider";
import { logger } from "@/server/shared/infrastructure/logger";
import { isOctokitError } from "@/server/shared/lib/handle-error";

import { githubTokenService } from "./github-token.service";

export const githubAppService = {
  async getInstallUrl(prisma: PrismaClientExtended, userId: number) {
    const state = crypto.randomBytes(32).toString("hex");

    await prisma.$transaction([
      prisma.verificationToken.deleteMany({
        where: { identifier: `github_install_${userId}` },
      }),
      prisma.verificationToken.create({
        data: {
          expires: new Date(Date.now() + 10 * 60 * 1000),
          identifier: `github_install_${userId}`,
          token: state,
        },
      }),
    ]);

    return `https://github.com/apps/doxynix/installations/new?state=${state}`;
  },

  async getMyRepos(db: DbClient, prisma: PrismaClientExtended, userId: number) {
    const installations = await db.githubInstallation.findMany({
      orderBy: { createdAt: "asc" },
      where: { isSuspended: false, userId },
    });

    const validToken = await githubTokenService.getValidToken(userId);

    const oauthStatus = validToken != null ? "valid" : "invalid";

    if (installations.length === 0 && validToken == null) {
      return {
        installationId: null,
        isConnected: false,
        items: [],
        manageUrl: null,
        oauthStatus: "missing" as const,
      };
    }

    const installationList = installations.map((inst) => ({
      avatar: inst.accountAvatar,
      id: Number(inst.id),
      login: inst.accountLogin,
      manageUrl: inst.htmlUrl,
    }));

    // Skip OAuth calls when validToken is null (installation-only scenario)
    if (validToken == null) {
      return {
        installations: installationList,
        isConnected: true,
        items: [],
        oauthStatus,
      };
    }

    try {
      const repos = await getMyRepos(prisma, userId);

      return {
        installations: installationList,
        isConnected: true,
        items: repos,
        oauthStatus,
      };
    } catch (error) {
      logger.error({ error, msg: "Dashboard fetch failed", userId });
      return {
        installations: installationList,
        isConnected: true,
        items: [],
        oauthStatus,
      };
    }
  },

  async saveInstallation(
    prisma: PrismaClientExtended,
    userIdNum: number,
    installationId: string,
    state: string
  ) {
    const instIdBigInt = BigInt(installationId);
    const inputInstIdNum = Number(installationId);

    const consumedState = await prisma.verificationToken.deleteMany({
      where: {
        expires: { gt: new Date() },
        identifier: `github_install_${userIdNum}`,
        token: state,
      },
    });

    if (consumedState.count === 0) {
      logger.warn({ msg: "CSRF/Replay attack or expired state", userId: userIdNum });
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Invalid, expired, or already used security state. Please try installing again.",
      });
    }

    const validToken = await githubTokenService.getValidToken(userIdNum);

    if (validToken == null) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "You must link your GitHub account before installing the app.",
      });
    }

    let hasAccess = false;
    try {
      const userOctokit = getUserClient(validToken);
      const userInstallations = await userOctokit.paginate(
        userOctokit.rest.apps.listInstallationsForAuthenticatedUser,
        { per_page: 100 }
      );

      if (userInstallations.some((inst) => inst.id === inputInstIdNum)) {
        hasAccess = true;
      }
    } catch (error) {
      if (isOctokitError(error) && (error.status === 401 || error.status === 403)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "GitHub authorization expired. Please relink your GitHub account.",
        });
      }
      logger.warn({ error, msg: "GitHub API verification failed for one OAuth account" });
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to verify installation ownership via GitHub.",
      });
    }

    if (!hasAccess) {
      logger.warn({
        installationId,
        msg: "IDOR attempt: User tried to claim unowned installation",
        userId: userIdNum,
      });
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "You do not have permission to claim this GitHub installation.",
      });
    }

    const installationInfo = await getInstallationInfo(inputInstIdNum);
    const account = installationInfo.account;
    const accountLogin = account !== null && "login" in account ? account.login : "Unknown";
    const accountAvatar = account !== null && "avatar_url" in account ? account.avatar_url : null;
    const repoSelection =
      installationInfo.repository_selection.toUpperCase() as RepositorySelection;
    const targetType = (
      installationInfo.target_type || "USER"
    ).toUpperCase() as InstallationTargetType;

    try {
      const updated = await prisma.githubInstallation.updateMany({
        data: {
          accountAvatar,
          accountLogin,
          htmlUrl: installationInfo.html_url,
          repositorySelection: repoSelection,
          userId: userIdNum,
        },
        where: {
          id: instIdBigInt,
          OR: [{ userId: null }, { userId: userIdNum }],
        },
      });

      if (updated.count === 0) {
        const created = await prisma.githubInstallation.createMany({
          data: [
            {
              accountAvatar,
              accountLogin,
              appId: installationInfo.app_id,
              htmlUrl: installationInfo.html_url,
              id: instIdBigInt,
              repositorySelection: repoSelection,
              targetId: BigInt(installationInfo.target_id),
              targetType,
              userId: userIdNum,
            },
          ],
          skipDuplicates: true,
        });

        if (created.count === 0) {
          const claimed = await prisma.githubInstallation.updateMany({
            data: {
              accountAvatar,
              accountLogin,
              repositorySelection: repoSelection,
              userId: userIdNum,
            },
            where: {
              id: instIdBigInt,
              OR: [{ userId: null }, { userId: userIdNum }],
            },
          });

          if (claimed.count === 0) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "This installation is already linked to another workspace.",
            });
          }
        }
      }
    } catch (error) {
      if (error instanceof TRPCError) throw error;

      logger.error({ error, msg: "Failed to securely claim installation" });
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to securely claim installation.",
      });
    }

    return { success: true };
  },
};
