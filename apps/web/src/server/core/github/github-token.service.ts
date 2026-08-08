import { createOAuthUserAuth } from "@octokit/auth-app";
import { getAccountForUpdate } from "@prisma/client/sql";

import { AUTH_PROVIDERS } from "@/shared/constants/env.server";

import { appLogger } from "../app-logger";
import { prisma } from "../db";

const REFRESH_THRESHOLD_MS = 5 * 60 * 1000; // TIME: 5 минут

export const githubTokenService = {
  async getValidToken(userId: number): Promise<null | string> {
    const account = await prisma.account.findFirst({
      select: { accessToken: true, accessTokenExpiresAt: true, id: true, refreshToken: true },
      where: { providerId: "github", userId },
    });

    if (
      account == null ||
      account.accessToken == null ||
      account.refreshToken == null ||
      account.accessTokenExpiresAt == null
    ) {
      return null;
    }

    const isExpired = Date.now() > account.accessTokenExpiresAt.getTime() - REFRESH_THRESHOLD_MS;
    if (!isExpired) return account.accessToken;

    try {
      return await prisma.$transaction(async (tx) => {
        await tx.$queryRawTyped(getAccountForUpdate(userId, "github"));
        const lockedAccount = await tx.account.findFirst({
          where: { providerId: "github", userId },
        });

        if (
          lockedAccount == null ||
          lockedAccount.accessToken == null ||
          lockedAccount.refreshToken == null ||
          lockedAccount.accessTokenExpiresAt == null
        ) {
          return null;
        }

        const stillExpired =
          Date.now() > lockedAccount.accessTokenExpiresAt.getTime() - REFRESH_THRESHOLD_MS;

        if (!stillExpired) {
          return lockedAccount.accessToken;
        }

        appLogger.info({ msg: "GitHub token expiring soon, initiating manual refresh", userId });

        const auth = createOAuthUserAuth({
          clientId: AUTH_PROVIDERS.github.id,
          clientSecret: AUTH_PROVIDERS.github.secret,
          clientType: "github-app",
          expiresAt: lockedAccount.accessTokenExpiresAt.toISOString(),
          refreshToken: lockedAccount.refreshToken,
          token: lockedAccount.accessToken,
        });

        const authentication = await auth({ type: "refresh" });

        const authData = authentication as {
          expiresAt: string;
          refreshToken: string;
          token: string;
        };

        const updated = await tx.account.update({
          data: {
            accessToken: authData.token,
            accessTokenExpiresAt: new Date(authData.expiresAt),
            refreshToken: authData.refreshToken,
          },
          where: { id: lockedAccount.id },
        });
        appLogger.info({ msg: "GitHub token successfully refreshed and saved", userId });
        return updated.accessToken;
      });
    } catch (error) {
      appLogger.error({ error, msg: "Token rotation failed", userId });

      const isFatal =
        error instanceof Error &&
        "status" in error &&
        (error.status === 400 || error.status === 401);

      // Clear tokens for poisoned account to prevent infinite retry
      if (isFatal) {
        try {
          await prisma.account.updateMany({
            data: {
              accessToken: null,
              accessTokenExpiresAt: null,
              refreshToken: null,
            },
            where: {
              providerId: "github",
              userId,
            },
          });
          appLogger.info({
            msg: "Cleared poisoned GitHub tokens to prevent infinite retry",
            userId,
          });
        } catch (cleanupError) {
          appLogger.error({
            cleanupError,
            msg: "Failed to clear poisoned tokens",
            userId,
          });
        }
      }

      return null;
    }
  },
};
