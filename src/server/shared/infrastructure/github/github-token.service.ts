import { createOAuthUserAuth } from "@octokit/auth-oauth-user";
import { getAccountForUpdate } from "@prisma/client/sql";

import { AUTH_PROVIDERS } from "@/shared/constants/env.server";

import { prisma } from "@/server/shared/infrastructure/db";
import { logger } from "@/server/shared/infrastructure/logger";

const REFRESH_THRESHOLD_MS = 5 * 60 * 1000; // TIME: 5 минут

export const githubTokenService = {
  async getValidToken(userId: number): Promise<null | string> {
    const account = await prisma.account.findFirst({
      select: { access_token: true, expires_at: true, id: true, refresh_token: true },
      where: { provider: "github", userId },
    });

    if (
      account == null ||
      account.access_token == null ||
      account.refresh_token == null ||
      account.expires_at == null
    ) {
      return null;
    }

    const isExpired = Date.now() > account.expires_at * 1000 - REFRESH_THRESHOLD_MS;
    if (!isExpired) return account.access_token;

    try {
      return await prisma.$transaction(async (tx) => {
        const accounts = await tx.$queryRawTyped(getAccountForUpdate(userId, "github"));
        const lockedAccount = accounts[0];

        if (
          lockedAccount == null ||
          lockedAccount.access_token == null ||
          lockedAccount.refresh_token == null ||
          lockedAccount.expires_at == null
        ) {
          return null;
        }

        const stillExpired =
          Date.now() > Number(lockedAccount.expires_at) * 1000 - REFRESH_THRESHOLD_MS;

        if (!stillExpired) {
          return lockedAccount.access_token;
        }

        logger.info({ msg: "GitHub token expiring soon, initiating manual refresh", userId });

        const auth = createOAuthUserAuth({
          clientId: AUTH_PROVIDERS.github.id,
          clientSecret: AUTH_PROVIDERS.github.secret,
          clientType: "github-app",
          expiresAt: new Date(Number(lockedAccount.expires_at) * 1000).toISOString(),
          refreshToken: lockedAccount.refresh_token,
          token: lockedAccount.access_token,
        });

        const authentication = await auth({ type: "refresh" });

        const authData = authentication as {
          expiresAt: string;
          refreshToken: string;
          token: string;
        };

        const updated = await tx.account.update({
          data: {
            access_token: authData.token,
            expires_at: Math.floor(new Date(authData.expiresAt).getTime() / 1000),
            refresh_token: authData.refreshToken,
          },
          where: { id: lockedAccount.id },
        });
        logger.info({ msg: "GitHub token successfully refreshed and saved", userId });
        return updated.access_token;
      });
    } catch (error) {
      logger.error({ error, msg: "Token rotation failed", userId });

      const isFatal =
        error instanceof Error &&
        "status" in error &&
        (error.status === 400 || error.status === 401);

      // Clear tokens for poisoned account to prevent infinite retry
      if (isFatal) {
        try {
          await prisma.account.updateMany({
            data: {
              access_token: null,
              expires_at: null,
              refresh_token: null,
            },
            where: {
              provider: "github",
              userId,
            },
          });
          logger.info({
            msg: "Cleared poisoned GitHub tokens to prevent infinite retry",
            userId,
          });
        } catch (cleanupError) {
          logger.error({
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
