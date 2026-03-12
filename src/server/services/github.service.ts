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
  async getClientContext(prisma: DbClient, userId: number): Promise<GitHubClientContext> {
    const account = await prisma.account.findFirst({
      where: { provider: "github", userId },
    });
    const commonConfig = getCommonConfig();
    const appId = Number(GITHUB_APP_ID);
    const privateKey = GITHUB_APP_PRIVATE_KEY;

    if (account?.githubInstallationId != null) {
      return {
        githubInstallationId: Number(account.githubInstallationId),
        hasUserToken: false,
        octokit: new MyOctokit({
          ...commonConfig,
          auth: {
            appId,
            installationId: Number(account.githubInstallationId),
            privateKey,
          },
          authStrategy: createAppAuth,
        }),
        type: "installation",
      };
    }

    if (account?.access_token != null) {
      return {
        hasUserToken: true,
        octokit: new MyOctokit({
          ...commonConfig,
          auth: account.access_token,
        }),
        type: "oauth",
      };
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
      }),
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

  async getMyRepos(prisma: DbClient, userId: number, limit?: number): Promise<RepoItemFields[]> {
    try {
      const clientContext = await this.getClientContext(prisma, userId);
      const { octokit } = clientContext;

      if (clientContext.type === "installation") {
        if (limit != null) {
          const { data } = await octokit.rest.apps.listReposAccessibleToInstallation({
            per_page: limit,
          });
          return this.mapRepos(data.repositories);
        }

        const repos = await octokit.paginate(octokit.rest.apps.listReposAccessibleToInstallation, {
          per_page: 100,
        });
        return this.mapRepos(repos);
      }

      if (clientContext.type === "oauth") {
        if (limit != null) {
          const { data } = await octokit.rest.repos.listForAuthenticatedUser({
            direction: "desc",
            per_page: limit,
            sort: "updated",
            visibility: "all",
          });
          return this.mapRepos(data);
        }

        const repos = await octokit.paginate(octokit.rest.repos.listForAuthenticatedUser, {
          direction: "desc",
          per_page: 100,
          sort: "updated",
          visibility: "all",
        });
        return this.mapRepos(repos);
      }

      logger.warn({ msg: "GitHub account not linked. Cannot fetch private repos.", userId });
      return [];
    } catch (error) {
      logger.error({ error, msg: "Error fetching repositories", userId });
      return [];
    }
  },

  async getRepoInfo(prisma: DbClient, userId: number, owner: string, name: string) {
    const { octokit } = await this.getClientContext(prisma, userId);
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
      const { octokit } = await this.getClientContext(prisma, userId);

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

  async getToken(prisma: DbClient, userId: number): Promise<string | null> {
    const context = await this.getClientContext(prisma, userId);

    if (context.type === "app") {
      return null;
    }

    try {
      const auth = (await context.octokit.auth()) as { token: string };
      return auth.token;
    } catch (error) {
      console.error(error);
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
