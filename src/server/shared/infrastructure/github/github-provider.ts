import { createAppAuth } from "@octokit/auth-app";
import { paginateRest } from "@octokit/plugin-paginate-rest";
import { retry } from "@octokit/plugin-retry";
import { throttling } from "@octokit/plugin-throttling";
import { Octokit } from "@octokit/rest";
import type { RequestOptions } from "@octokit/types";
import gitUrlParse from "git-url-parse";
import { createPullRequest } from "octokit-plugin-create-pull-request";

import {
  APP_VERSION,
  GITHUB_APP_ID,
  GITHUB_APP_PRIVATE_KEY,
  GITHUB_SYSTEM_INSTALLATION_ID,
  GITHUB_SYSTEM_PAT,
} from "@/shared/constants/env.server";

import type { DbClient } from "../db";
import { logger } from "../logger";
import { githubTokenService } from "./github-token.service";

const AppOctokit = Octokit.plugin(retry, throttling, paginateRest, createPullRequest);
export type OctokitInstance = InstanceType<typeof AppOctokit>;

const getCommonConfig = () => ({
  log: {
    debug: (msg: string) => logger.debug({ msg }),
    error: (msg: string) => logger.error({ msg }),
    info: (msg: string) => logger.info({ msg }),
    warn: (msg: string) => logger.warn({ msg }),
  },
  retry: {
    doNotRetry: [400, 401, 403, 429, 409, 422, 451, 404],
  },
  throttle: {
    onRateLimit: (
      retryAfter: number,
      options: RequestOptions,
      octokit: any,
      retryCount: number
    ) => {
      octokit.log.warn(
        `Rate limit hit: ${options.method} ${options.url}. Retrying after ${retryAfter}s. (Attempt ${retryCount})`
      );
      return retryCount < 2;
    },

    onSecondaryRateLimit: (
      retryAfter: number,
      options: RequestOptions,
      octokit: any,
      retryCount = 0
    ) => {
      octokit.log.warn(
        `Secondary rate limit hit: ${options.method} ${options.url}. Retrying after ${retryAfter}s. (Attempt ${retryCount})`
      );
      return retryCount < 2;
    },
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
  }) as OctokitInstance;
}

function getPublicClient(token?: string): OctokitInstance {
  return new AppOctokit({
    ...getCommonConfig(),
    auth: token,
  }) as OctokitInstance;
}

function getSystemClient(): OctokitInstance {
  return getInstallationClient(Number(GITHUB_SYSTEM_INSTALLATION_ID));
}

export function getUserClient(token: string): OctokitInstance {
  return getPublicClient(token);
}

export class GitHubAuthRequiredError extends Error {
  constructor() {
    super(
      "No valid GitHub authorization found. Please connect your GitHub account or install the app."
    );
    this.name = "GitHubAuthRequiredError";
  }
}

export type GitHubClientContext = (
  | { githubInstallationId: number; hasUserToken: false; type: "installation" }
  | { hasUserToken: false; type: "app" }
  | { hasUserToken: false; type: "public" }
  | { hasUserToken: true; type: "oauth" }
) & {
  octokit: OctokitInstance;
};

export type ClientContextOptions = {
  allowPublicFallback?: boolean;
  allowSystemFallback?: boolean;
  owner?: string;
};

/**
 * Resolves user's GitHub client context based on available credentials
 * Priority: specific installation > oauth > any installation
 * Throws GitHubAuthRequiredError if no context available
 */
export async function getClientContext(
  prisma: DbClient,
  userId: number,
  owner?: string
): Promise<GitHubClientContext> {
  // Try specific installation for owner
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

  // Get token
  const validToken = await githubTokenService.getValidToken(userId);
  if (validToken != null) {
    return {
      hasUserToken: true,
      octokit: getUserClient(validToken),
      type: "oauth",
    };
  }

  // Try any installation (if owner not specified)
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

/**
 * Resolves client context with fallback chain:
 * 1. Primary client context
 * 2. If auth fails: public PAT (if allowPublicFallback)
 * 3. If auth fails: system app (if allowSystemFallback)
 */
export async function resolveClientContext(
  prisma: DbClient,
  userId: number,
  options?: ClientContextOptions
): Promise<GitHubClientContext> {
  try {
    return await getClientContext(prisma, userId, options?.owner);
  } catch (error) {
    if (error instanceof GitHubAuthRequiredError) {
      // Fallback 1: System PAT for public queries
      if (options?.allowPublicFallback === true) {
        return {
          hasUserToken: false,
          octokit: getPublicClient(GITHUB_SYSTEM_PAT),
          type: "public",
        };
      }

      // Fallback 2: System app installation
      if (options?.allowSystemFallback === true) {
        return {
          hasUserToken: false,
          octokit: getSystemClient(),
          type: "app",
        };
      }
    }
    throw error;
  }
}

/**
 * Parses GitHub URL or owner/repo string
 * Validates and normalizes owner and name
 * Throws if format invalid
 */
export function parseUrl(input: string): { name: string; owner: string } {
  const trimmedInput = input.trim();
  if (trimmedInput === "") throw new Error("Field cannot be empty");

  try {
    const parsed = gitUrlParse(trimmedInput);

    return {
      name: parsed.name,
      owner: parsed.owner,
    };
  } catch {
    throw new Error("Invalid format. Enter 'owner/repo' or repository URL");
  }
}

/**
 * Retrieves GitHub token for user and optional owner
 * Returns null if token unavailable (logs error)
 */
export async function getToken(
  prisma: DbClient,
  userId: number,
  owner?: string
): Promise<null | string> {
  try {
    const context = await getClientContext(prisma, userId, owner);
    const auth =
      context.type === "installation"
        ? ((await context.octokit.auth({ type: "installation" })) as { token: string })
        : ((await context.octokit.auth()) as { token: string });
    return auth.token;
  } catch (error) {
    logger.error({ error, msg: "Failed to resolve GitHub token", userId });
    return null;
  }
}
/**
 * Gets installation metadata from GitHub App
 * Requires system app credentials
 */
export async function getInstallationInfo(installationId: number) {
  const octokit = getSystemClient();
  const { data } = await octokit.rest.apps.getInstallation({
    installation_id: installationId,
  });
  return data;
}
