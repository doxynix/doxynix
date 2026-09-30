import { createAppAuth } from "@octokit/auth-app";
import { paginateRest } from "@octokit/plugin-paginate-rest";
import { retry } from "@octokit/plugin-retry";
import type { ThrottlingOptions } from "@octokit/plugin-throttling";
import { throttling } from "@octokit/plugin-throttling";
import { Octokit } from "@octokit/rest";
import { createPullRequest } from "octokit-plugin-create-pull-request";

import {
  APP_VERSION,
  GITHUB_APP_ID,
  GITHUB_APP_PRIVATE_KEY,
  GITHUB_SYSTEM_INSTALLATION_ID,
  GITHUB_SYSTEM_PAT,
} from "@/shared/config/env.server";

import { parseGitUrl } from "@/server/core/git/parse-url";

import { AppError } from "../api-error";
import { appLogger } from "../app-logger";
import type { DbClient } from "../db";
import { githubTokenService } from "./github-token.service";

const AppOctokit = Octokit.plugin(retry, throttling, paginateRest, createPullRequest);
export type OctokitInstance = InstanceType<typeof AppOctokit>;

// The `boolean` return is load-bearing: the plugin reads it to decide on retry even though the published signature declares `void`; `ThrottlingOptions` is a union whose second member makes both handlers optional, hence the `NonNullable`.
type ThrottleHandler = NonNullable<ThrottlingOptions["onRateLimit"]>;

const onRateLimit: ThrottleHandler = (retryAfter, options, octokit, retryCount) => {
  octokit.log.warn(
    `Rate limit hit: ${options.method} ${options.url}. Retrying after ${retryAfter}s. (Attempt ${retryCount})`,
  );
  return retryCount < 2;
};

const onSecondaryRateLimit: NonNullable<ThrottlingOptions["onSecondaryRateLimit"]> = (
  retryAfter,
  options,
  octokit,
  retryCount,
) => {
  octokit.log.warn(
    `Secondary rate limit hit: ${options.method} ${options.url}. Retrying after ${retryAfter}s. (Attempt ${retryCount})`,
  );
  return retryCount < 2;
};

const getCommonConfig = () => ({
  log: {
    debug: (msg: string) => appLogger.debug({ msg }),
    error: (msg: string) => appLogger.error({ msg }),
    info: (msg: string) => appLogger.info({ msg }),
    warn: (msg: string) => appLogger.warn({ msg }),
  },
  retry: {
    doNotRetry: [400, 401, 403, 429, 409, 422, 451, 404],
  },
  throttle: {
    onRateLimit,
    onSecondaryRateLimit,
  },
  userAgent: `Doxynix/${APP_VERSION}`,
});

export function getInstallationClient(installationId: number): OctokitInstance {
  return new AppOctokit({
    ...getCommonConfig(),

    auth: {
      appId: Number(GITHUB_APP_ID),
      installationId,
      privateKey: GITHUB_APP_PRIVATE_KEY,
    },
    authStrategy: createAppAuth,
  });
}

export function getPublicClient(token?: string): OctokitInstance {
  return new AppOctokit({
    ...getCommonConfig(),
    auth: token,
  });
}

export class GitHubAuthRequiredError extends Error {
  constructor() {
    super(
      "No valid GitHub authorization found. Please connect your GitHub account or install the app.",
    );
    this.name = "GitHubAuthRequiredError";
  }
}

type GitHubClientContext = (
  | { githubInstallationId: number; hasUserToken: false; type: "installation" }
  | { hasUserToken: false; type: "app" }
  | { hasUserToken: false; type: "public" }
  | { hasUserToken: true; type: "oauth" }
) & {
  octokit: OctokitInstance;
};

type ClientContextOptions = {
  allowPublicFallback?: boolean;
  allowSystemFallback?: boolean;
  owner?: string;
};

// Priority: specific installation > oauth > any installation; throws `GitHubAuthRequiredError` when nothing is available.
export async function getClientContext(
  prisma: DbClient,
  userId: string,
  owner?: string,
): Promise<GitHubClientContext> {
  if (owner != null) {
    const specificInstallation = await prisma.githubInstallation.findFirst({
      where: { accountLogin: { equals: owner, mode: "insensitive" }, isSuspended: false, userId },
    });

    if (specificInstallation != null) {
      return {
        githubInstallationId: Number(specificInstallation.id),
        hasUserToken: false,
        octokit: getInstallationClient(Number(specificInstallation.id)),
        type: "installation",
      };
    }
  }

  const validToken = await githubTokenService.getValidToken(userId);
  if (validToken != null) {
    return {
      hasUserToken: true,
      octokit: getPublicClient(validToken),
      type: "oauth",
    };
  }

  if (owner == null) {
    const anyInstallation = await prisma.githubInstallation.findFirst({
      where: { isSuspended: false, userId },
    });

    if (anyInstallation != null) {
      return {
        githubInstallationId: Number(anyInstallation.id),
        hasUserToken: false,
        octokit: getInstallationClient(Number(anyInstallation.id)),
        type: "installation",
      };
    }
  }

  throw new GitHubAuthRequiredError();
}

export async function resolveClientContext(
  prisma: DbClient,
  userId: string,
  options?: ClientContextOptions,
): Promise<GitHubClientContext> {
  try {
    return await getClientContext(prisma, userId, options?.owner);
  } catch (error) {
    if (error instanceof GitHubAuthRequiredError) {
      if (options?.allowPublicFallback === true) {
        return {
          hasUserToken: false,
          octokit: getPublicClient(GITHUB_SYSTEM_PAT),
          type: "public",
        };
      }

      if (options?.allowSystemFallback === true) {
        return {
          hasUserToken: false,
          octokit: getInstallationClient(Number(GITHUB_SYSTEM_INSTALLATION_ID)),
          type: "app",
        };
      }
    }
    throw error;
  }
}

export function parseUrl(input: string): { name: string; owner: string } {
  const trimmedInput = input.trim();
  if (trimmedInput === "") {
    // Typed rather than a bare `Error` so both transports agree: an empty string is a bad request, not a server fault.
    throw new AppError({ code: "BAD_REQUEST", publicMessage: "Field cannot be empty" });
  }

  try {
    const parsed = parseGitUrl(trimmedInput);

    return {
      name: parsed.name,
      owner: parsed.owner,
    };
  } catch {
    throw new AppError({
      code: "BAD_REQUEST",
      publicMessage: "Invalid format. Enter 'owner/repo' or repository URL",
    });
  }
}

// Always authenticates as the system app, whatever `installationId` is passed.
export async function getInstallationInfo(installationId: number) {
  const octokit = getInstallationClient(Number(GITHUB_SYSTEM_INSTALLATION_ID));
  const { data } = await octokit.rest.apps.getInstallation({
    installation_id: installationId,
  });
  return data;
}
