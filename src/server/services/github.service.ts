import { createAppAuth } from "@octokit/auth-app";
import { paginateRest } from "@octokit/plugin-paginate-rest";
import { retry } from "@octokit/plugin-retry";
import { throttling } from "@octokit/plugin-throttling";
import { Octokit, type RestEndpointMethodTypes } from "@octokit/rest";
import type { RequestOptions } from "@octokit/types";
import { Visibility } from "@prisma/client";
import parseGithubUrl from "parse-github-url";

import {
  GITHUB_APP_ID,
  GITHUB_APP_PRIVATE_KEY,
  GITHUB_SYSTEM_INSTALLATION_ID,
} from "@/shared/constants/env.server";
import type { RepoItemFields } from "@/shared/types/repo";

import type { DbClient } from "../db/db";
import { logger } from "../logger/logger";
import { FileClassifier } from "../utils/file-classifier";
import { isOctokitError } from "../utils/handle-error";

const MyOctokit = Octokit.plugin(retry, throttling, paginateRest);
export type OctokitInstance = InstanceType<typeof MyOctokit>;

type SearchRepoItem =
  RestEndpointMethodTypes["search"]["repos"]["response"]["data"]["items"][number];
type ListRepoItem =
  RestEndpointMethodTypes["repos"]["listForAuthenticatedUser"]["response"]["data"][number];
type InstallationRepoItem =
  RestEndpointMethodTypes["apps"]["listReposAccessibleToInstallation"]["response"]["data"]["repositories"][number];

type GitHubRepoResponse = SearchRepoItem | ListRepoItem | InstallationRepoItem;

type GitHubClientContext = (
  | { githubInstallationId: number; hasUserToken: false; type: "installation" }
  | { hasUserToken: true; type: "oauth" }
) & {
  octokit: OctokitInstance;
};

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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      octokit: any,
      retryCount = 0
    ) => {
      octokit.log.warn(
        `Secondary rate limit hit: ${options.method} ${options.url}. Retrying after ${retryAfter}s. (Attempt ${retryCount})`
      );
      return retryCount < 2;
    },
  },
  userAgent: "Doxynix/1.0.0",
});

export const githubService = {
  async executeWithFallback<T>(
    prisma: DbClient,
    userId: number,
    initialOctokit: OctokitInstance,
    initialType: string,
    operation: (client: OctokitInstance) => Promise<T>
  ): Promise<T> {
    try {
      return await operation(initialOctokit);
    } catch (error) {
      if (
        (initialType === "installation" || initialType === "oauth") &&
        isOctokitError(error) &&
        (error.status === 403 || error.status === 404)
      ) {
        const oauthAccounts = await prisma.account.findMany({
          where: { access_token: { not: null }, provider: "github", userId },
        });

        for (const oauthAcc of oauthAccounts) {
          if (oauthAcc.access_token == null) continue;
          try {
            const fallbackOctokit = this.getUserClient(oauthAcc.access_token);
            return await operation(fallbackOctokit);
          } catch (fallbackError) {
            logger.error({ error: fallbackError, msg: "Token didn't work in fallback" });
            continue;
          }
        }
      }
      throw error;
    }
  },

  async getClientContext(
    prisma: DbClient,
    userId: number,
    owner?: string
  ): Promise<GitHubClientContext> {
    if (owner != null) {
      const specificInstallation = await prisma.githubInstallation.findFirst({
        where: { accountLogin: { equals: owner, mode: "insensitive" }, isSuspended: false, userId },
      });

      if (specificInstallation != null) {
        return {
          githubInstallationId: Number(specificInstallation.id),
          hasUserToken: false,
          octokit: this.getInstallationClient(Number(specificInstallation.id)),
          type: "installation",
        };
      }
    }

    const oauthAccounts = await prisma.account.findMany({
      where: { access_token: { not: null }, provider: "github", userId },
    });

    if (oauthAccounts.length > 0 && oauthAccounts[0]?.access_token != null) {
      return {
        hasUserToken: true,
        octokit: this.getUserClient(oauthAccounts[0].access_token),
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
          octokit: this.getInstallationClient(Number(anyInstallation.id)),
          type: "installation",
        };
      }
    }

    throw new Error(
      "No valid GitHub authorization found. Please connect your GitHub account or install the app."
    );
  },

  getInstallationClient(installationId: number): OctokitInstance {
    return new MyOctokit({
      ...getCommonConfig(),
      auth: {
        appId: Number(GITHUB_APP_ID),
        installationId,
        privateKey: GITHUB_APP_PRIVATE_KEY,
      },
      authStrategy: createAppAuth,
    }) as OctokitInstance;
  },

  async getInstallationInfo(installationId: number) {
    const octokit = this.getSystemClient();
    const { data } = await octokit.rest.apps.getInstallation({
      installation_id: installationId,
    });
    return data;
  },

  async getMyRepos(prisma: DbClient, userId: number): Promise<RepoItemFields[]> {
    try {
      const [installations, oauthAccounts] = await Promise.all([
        prisma.githubInstallation.findMany({
          where: { isSuspended: false, userId },
        }),
        prisma.account.findMany({
          where: { access_token: { not: null }, provider: "github", userId },
        }),
      ]);

      if (installations.length === 0 && oauthAccounts.length === 0) return [];

      const installationTasks = installations.map(async (inst) => {
        try {
          const octokit = this.getInstallationClient(Number(inst.id));
          const repos = await octokit.paginate(octokit.rest.apps.listReposAccessibleToInstallation);
          return this.mapRepos(repos as GitHubRepoResponse[]);
        } catch (error) {
          logger.error({ error, installationId: inst.id, msg: "Failed installation fetch" });
          return [];
        }
      });

      const oauthTasks = oauthAccounts.map(async (account) => {
        try {
          const octokit = this.getUserClient(account.access_token!);
          const repos = await octokit.paginate(octokit.rest.repos.listForAuthenticatedUser, {
            per_page: 100,
            visibility: "all",
          });
          return this.mapRepos(repos);
        } catch (error) {
          logger.error({ accountId: account.id, error, msg: "Failed OAuth fetch" });
          return [];
        }
      });

      const results = await Promise.allSettled([...installationTasks, ...oauthTasks]);

      const allRepos = results.flatMap((result) =>
        result.status === "fulfilled" ? result.value : []
      );

      return Array.from(new Map(allRepos.map((r) => [r.fullName, r])).values());
    } catch (error) {
      logger.error({ error, msg: "Error fetching combined repositories", userId });
      return [];
    }
  },

  async getRepoInfo(prisma: DbClient, userId: number, owner: string, name: string) {
    let octokit;
    let type;
    try {
      const context = await this.getClientContext(prisma, userId, owner);
      octokit = context.octokit;
      type = context.type;
    } catch (err) {
      if (err instanceof Error && err.message.includes("No valid GitHub")) {
        octokit = this.getSystemClient();
        type = "app";
      } else {
        throw err;
      }
    }

    return this.executeWithFallback(prisma, userId, octokit, type, async (client) => {
      const { data } = await client.rest.repos.get({ owner, repo: name });
      return data;
    });
  },

  async getRepoTree(
    prisma: DbClient,
    userId: number,
    owner: string,
    name: string,
    branch?: string
  ) {
    let activeOctokit;
    let type;
    try {
      const context = await this.getClientContext(prisma, userId, owner);
      activeOctokit = context.octokit;
      type = context.type;
    } catch (err) {
      if (err instanceof Error && err.message.includes("No valid GitHub")) {
        activeOctokit = this.getSystemClient();
        type = "app";
      } else {
        throw err;
      }
    }

    try {
      return await this.executeWithFallback(prisma, userId, activeOctokit, type, async (client) => {
        const { data: repoData } = await client.rest.repos.get({ owner, repo: name });
        const treeSha = branch ?? repoData.default_branch;

        const { data } = await client.rest.git.getTree({
          owner,
          recursive: "1",
          repo: name,
          tree_sha: treeSha,
        });

        return data.tree
          .filter((item) => {
            if (!item.path) return false;
            if (item.type !== "blob") return false;
            return !FileClassifier.isIgnored(item.path);
          })
          .map((item) => ({ path: item.path, sha: item.sha, type: item.type }));
      });
    } catch (error) {
      if (isOctokitError(error)) {
        logger.info({ msg: "Repo empty or not found", status: error.status });
        return [];
      }
      logger.error({ error, msg: "Error fetching repo tree" });
      throw error;
    }
  },

  getSystemClient(): OctokitInstance {
    return new MyOctokit({
      ...getCommonConfig(),
      auth: {
        appId: Number(GITHUB_APP_ID),
        installationId: Number(GITHUB_SYSTEM_INSTALLATION_ID),
        privateKey: GITHUB_APP_PRIVATE_KEY,
      },
      authStrategy: createAppAuth,
    }) as OctokitInstance;
  },

  async getToken(prisma: DbClient, userId: number, owner?: string): Promise<string | null> {
    try {
      const context = await this.getClientContext(prisma, userId, owner);
      const auth =
        context.type === "installation"
          ? ((await context.octokit.auth({ type: "installation" })) as { token: string })
          : ((await context.octokit.auth()) as { token: string });
      return auth.token;
    } catch (error) {
      logger.error({ error, msg: "Failed to resolve GitHub token", userId });
      return null;
    }
  },

  getUserClient(token: string): OctokitInstance {
    return new MyOctokit({
      ...getCommonConfig(),
      auth: token,
    }) as OctokitInstance;
  },

  mapRepos(data: GitHubRepoResponse[]): RepoItemFields[] {
    return data.map((repo) => ({
      description: repo.description ?? null,
      fullName: repo.full_name,
      language: repo.language ?? null,
      stars: repo.stargazers_count,
      updatedAt: repo.updated_at ?? new Date().toISOString(),
      visibility: repo.private ? Visibility.PRIVATE : Visibility.PUBLIC,
    }));
  },

  parseUrl(input: string): { name: string; owner: string } {
    if (input.trim() === "") throw new Error("Field cannot be empty");
    const parsed = parseGithubUrl(input);

    const owner = parsed?.owner?.trim() ?? "";
    const name = parsed?.name?.trim() ?? "";

    if (owner === "" || name === "") {
      throw new Error("Invalid format. Enter 'owner/repo' or repository URL");
    }

    return { name, owner };
  },

  async searchRepos(
    prisma: DbClient,
    userId: number,
    query: string,
    limit: number | undefined
  ): Promise<RepoItemFields[]> {
    if (query.length < 2 || query.length > 256) return [];

    let octokit;
    try {
      const context = await this.getClientContext(prisma, userId);
      octokit = context.octokit;
    } catch (e) {
      if (e instanceof Error && e.message.includes("No valid GitHub")) {
        octokit = this.getSystemClient();
      } else {
        throw e;
      }
    }

    try {
      const { data } = await octokit.rest.search.repos({
        per_page: limit ?? 10,
        q: query,
      });

      return data.items.map((repo) => ({
        description: repo.description,
        fullName: repo.full_name,
        language: repo.language,
        stars: repo.stargazers_count,
        updatedAt: repo.updated_at,
        visibility: repo.private ? Visibility.PRIVATE : Visibility.PUBLIC,
      }));
    } catch (error) {
      logger.error({ error, msg: "GitHub search error" });
      return [];
    }
  },
};
