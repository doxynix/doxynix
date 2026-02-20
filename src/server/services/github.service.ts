import { paginateRest } from "@octokit/plugin-paginate-rest";
import { retry } from "@octokit/plugin-retry";
import { throttling } from "@octokit/plugin-throttling";
import { Octokit, type RestEndpointMethodTypes } from "@octokit/rest";
import { Visibility, type PrismaClient } from "@prisma/client";
import parseGithubUrl from "parse-github-url";

import { SYSTEM_TOKEN } from "@/shared/constants/env.server";
import { logger } from "@/shared/lib/logger";
import type { RepoItemFields } from "@/shared/types/repo-item";

import { FileClassifier } from "../utils/file-classifier";

const MyOctokit = Octokit.plugin(retry, throttling, paginateRest);
type SearchRepoItem =
  RestEndpointMethodTypes["search"]["repos"]["response"]["data"]["items"][number];
type ListRepoItem =
  RestEndpointMethodTypes["repos"]["listForAuthenticatedUser"]["response"]["data"][number];

type GitHubRepoResponse = SearchRepoItem | ListRepoItem;

export const githubService = {
  parseUrl(input: string) {
    if (!input?.trim()) throw new Error("Field cannot be empty");

    const parsed = parseGithubUrl(input);

    if (
      parsed == null ||
      parsed.owner == null ||
      parsed.owner.trim().length === 0 ||
      parsed.name == null ||
      parsed.name.trim().length === 0
    ) {
      throw new Error("Invalid format. Enter 'owner/repo' or repository URL");
    }

    return { owner: parsed.owner, name: parsed.name };
  },

  async searchRepos(
    prisma: PrismaClient,
    userId: number,
    query: string,
    limit: number | undefined
  ): Promise<RepoItemFields[]> {
    if (query.length < 2 || query.length > 256) return [];

    const octokit = await this.getClientForUser(prisma, userId);

    try {
      const { data } = await octokit.search.repos({
        q: query,
        per_page: limit ?? 10,
      });

      return data.items.map((repo) => ({
        fullName: repo.full_name,
        stars: repo.stargazers_count,
        visibility: repo.private ? Visibility.PRIVATE : Visibility.PUBLIC,
        description: repo.description,
        language: repo.language,
        updatedAt: repo.updated_at,
      }));
    } catch (error) {
      logger.error({ msg: "GitHub search error", error });
      return [];
    }
  },

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async getMyRepos(prisma: any, userId: number, limit?: number): Promise<RepoItemFields[]> {
    try {
      const octokit = await this.getClientForUser(prisma, userId);

      if (limit != null) {
        const { data } = await octokit.rest.repos.listForAuthenticatedUser({
          sort: "updated",
          direction: "desc",
          per_page: limit,
          visibility: "all",
        });
        return this.mapRepos(data);
      }

      const repos = await octokit.paginate(octokit.rest.repos.listForAuthenticatedUser, {
        sort: "updated",
        direction: "desc",
        per_page: 100,
        visibility: "all",
      });

      return this.mapRepos(repos);
    } catch (error) {
      logger.error({ msg: "Error fetching repositories", userId, error });
      return [];
    }
  },

  mapRepos(data: GitHubRepoResponse[]): RepoItemFields[] {
    return data.map((repo) => ({
      fullName: repo.full_name,
      stars: repo.stargazers_count ?? 0,
      visibility: repo.private === true ? Visibility.PRIVATE : Visibility.PUBLIC,
      description: repo.description ?? null,
      language: repo.language ?? null,
      updatedAt: repo.updated_at ?? new Date().toISOString(),
    }));
  },

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async getClientForUser(prisma: any, userId: number) {
    const account = await prisma.account.findFirst({
      where: { userId, provider: "github" },
    });

    const token = account?.access_token ?? SYSTEM_TOKEN;

    // if (token == null) {
    //   logger.error({ msg: "Token not found in DB", userId });
    //   throw new Error("TOKEN_MISSING");
    // }
    return new MyOctokit({
      auth: token ?? undefined,
      userAgent: "Doxynix/1.0.0",

      log: {
        debug: (msg) => logger.debug({ msg }),
        info: (msg) => logger.info({ msg }),
        warn: (msg) => logger.warn({ msg }),
        error: (msg) => logger.error({ msg }),
      },

      throttle: {
        onRateLimit: (retryAfter, options, octokit, retryCount) => {
          octokit.log.warn(
            `Rate limit hit: ${options.method} ${options.url}. Retrying after ${retryAfter}s.`
          );
          return retryCount < 2;
        },
        onSecondaryRateLimit: (retryAfter, options, octokit) => {
          octokit.log.warn(
            `Secondary rate limit hit: ${options.method} ${options.url}. Retrying after ${retryAfter}s.`
          );
          return true;
        },
      },

      retry: {
        doNotRetry: ["429"],
      },
    });
  },

  async getRepoInfo(prisma: PrismaClient, userId: number, owner: string, name: string) {
    const octokit = await this.getClientForUser(prisma, userId);
    const { data } = await octokit.repos.get({ owner, repo: name });

    return data;
  },
  async getRepoTree(
    prisma: PrismaClient,
    userId: number,
    owner: string,
    name: string,
    branch?: string
  ) {
    const octokit = await this.getClientForUser(prisma, userId);

    const { data: repoData } = await octokit.repos.get({ owner, repo: name });
    const treeSha = branch ?? repoData.default_branch;

    const { data } = await octokit.git.getTree({
      owner,
      repo: name,
      tree_sha: treeSha,
      recursive: "1",
    });

    return data.tree
      .filter((item) => {
        if (!item.path) return false;
        if (item.type !== "blob") return false;

        return !FileClassifier.isIgnored(item.path);
      })
      .map((item) => ({
        path: item.path!,
        type: item.type,
        sha: item.sha,
      }));
  },
};
