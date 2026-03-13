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
  | { hasUserToken: false; type: "app" }
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onSecondaryRateLimit: (retryAfter: number, options: RequestOptions, octokit: any) => {
      octokit.log.warn(
        `Secondary rate limit hit: ${options.method} ${options.url}. Retrying after ${retryAfter}s.`
      );
      return true;
    },
  },
  userAgent: "Doxynix/1.0.0",
});

export const githubService = {
  async getClientContext(
    prisma: DbClient,
    userId: number,
    owner?: string
  ): Promise<GitHubClientContext> {
    const commonConfig = getCommonConfig();
    const appId = Number(GITHUB_APP_ID);
    const privateKey = GITHUB_APP_PRIVATE_KEY;

    if (owner != null) {
      const specificInstallation = await prisma.githubInstallation.findFirst({
        where: { accountLogin: { equals: owner, mode: "insensitive" }, userId },
      });

      if (specificInstallation != null) {
        return {
          githubInstallationId: Number(specificInstallation.id),
          hasUserToken: false,
          octokit: new MyOctokit({
            ...commonConfig,
            auth: {
              appId,
              installationId: Number(specificInstallation.id),
              privateKey,
            },
            authStrategy: createAppAuth,
          }) as OctokitInstance,
          type: "installation",
        };
      }
    }

    const oauthAcc = await prisma.account.findFirst({
      where: { access_token: { not: null }, provider: "github", userId },
    });

    if (oauthAcc?.access_token != null) {
      return {
        hasUserToken: true,
        octokit: new MyOctokit({
          ...commonConfig,
          auth: oauthAcc.access_token,
        }) as OctokitInstance,
        type: "oauth",
      };
    }

    if (owner == null) {
      const anyInstallation = await prisma.githubInstallation.findFirst({
        where: { userId },
      });

      if (anyInstallation != null) {
        return {
          githubInstallationId: Number(anyInstallation.id),
          hasUserToken: false,
          octokit: new MyOctokit({
            ...commonConfig,
            auth: {
              appId,
              installationId: Number(anyInstallation.id),
              privateKey,
            },
            authStrategy: createAppAuth,
          }) as OctokitInstance,
          type: "installation",
        };
      }
    }

    return {
      hasUserToken: false,
      octokit: new MyOctokit({
        ...commonConfig,
        auth: {
          appId,
          installationId: Number(GITHUB_SYSTEM_INSTALLATION_ID),
          privateKey,
        },
        authStrategy: createAppAuth,
      }) as OctokitInstance,
      type: "app",
    };
  },

  async getInstallationInfo(installationId: number) {
    const octokit = new MyOctokit({
      ...getCommonConfig(),
      auth: {
        appId: Number(GITHUB_APP_ID),
        privateKey: GITHUB_APP_PRIVATE_KEY,
      },
      authStrategy: createAppAuth,
    });

    const { data } = await octokit.rest.apps.getInstallation({
      installation_id: installationId,
    });

    return data;
  },

  async getMyRepos(prisma: DbClient, userId: number): Promise<RepoItemFields[]> {
    try {
      const allRepos: RepoItemFields[] = [];
      const commonConfig = getCommonConfig();

      const installations = await prisma.githubInstallation.findMany({
        where: { userId },
      });

      const oauthAccounts = await prisma.account.findMany({
        where: { access_token: { not: null }, provider: "github", userId },
      });

      if (installations.length === 0 && oauthAccounts.length === 0) {
        return [];
      }

      for (const inst of installations) {
        try {
          const octokit = new MyOctokit({
            ...commonConfig,
            auth: {
              appId: Number(GITHUB_APP_ID),
              installationId: Number(inst.id),
              privateKey: GITHUB_APP_PRIVATE_KEY,
            },
            authStrategy: createAppAuth,
          }) as OctokitInstance;

          const repos = await octokit.paginate(octokit.rest.apps.listReposAccessibleToInstallation);
          allRepos.push(...githubService.mapRepos(repos as GitHubRepoResponse[]));
        } catch (error) {
          logger.error({
            error,
            installationId: Number(inst.id),
            msg: "Failed to fetch repos for installation",
          });
        }
      }

      for (const account of oauthAccounts) {
        try {
          const octokit = new MyOctokit({
            ...commonConfig,
            auth: account.access_token!,
          }) as OctokitInstance;

          const repos = await octokit.paginate(octokit.rest.repos.listForAuthenticatedUser, {
            per_page: 100,
            visibility: "all",
          });
          allRepos.push(...githubService.mapRepos(repos));
        } catch (error) {
          logger.error({
            accountId: account.id,
            error,
            msg: "Failed to fetch repos for OAuth account",
          });
        }
      }

      return Array.from(new Map(allRepos.map((r) => [r.fullName, r])).values());
    } catch (error) {
      logger.error({ error, msg: "Error fetching combined repositories", userId });
      return [];
    }
  },

  async getRepoInfo(prisma: DbClient, userId: number, owner: string, name: string) {
    const { octokit } = await this.getClientContext(prisma, userId, owner);
    const { data } = await octokit.rest.repos.get({ owner, repo: name });
    return data;
  },

  async getRepoTree(
    prisma: DbClient,
    userId: number,
    owner: string,
    name: string,
    branch?: string
  ) {
    try {
      const { octokit } = await this.getClientContext(prisma, userId, owner);

      const { data: repoData } = await octokit.rest.repos.get({ owner, repo: name });
      const treeSha = branch ?? repoData.default_branch;

      const { data } = await octokit.rest.git.getTree({
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
        .map((item) => ({
          path: item.path,
          sha: item.sha,
          type: item.type,
        }));
    } catch (error) {
      if (isOctokitError(error)) {
        logger.info({ msg: "Repo empty or not found", status: error.status });
        return [];
      }
      logger.error({ error, msg: "Error fetching repo tree" });
      throw error;
    }
  },

  async getToken(prisma: DbClient, userId: number, owner?: string): Promise<string | null> {
    const context = await this.getClientContext(prisma, userId, owner);

    if (context.type === "app") {
      return null;
    }

    try {
      const auth = (await context.octokit.auth()) as { token: string };
      return auth.token;
    } catch (error) {
      logger.error({
        contextType: context.type,
        error,
        msg: "Failed to resolve GitHub token",
        userId,
      });
      return null;
    }
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

  parseUrl(input: string) {
    if (!input.trim()) throw new Error("Field cannot be empty");

    const parsed = parseGithubUrl(input);

    if (
      parsed?.owner == null ||
      parsed.owner.trim().length === 0 ||
      parsed.name == null ||
      parsed.name.trim().length === 0
    ) {
      throw new Error("Invalid format. Enter 'owner/repo' or repository URL");
    }

    return { name: parsed.name, owner: parsed.owner };
  },

  async searchRepos(
    prisma: DbClient,
    userId: number,
    query: string,
    limit: number | undefined
  ): Promise<RepoItemFields[]> {
    if (query.length < 2 || query.length > 256) return [];

    const { octokit } = await this.getClientContext(prisma, userId);

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
