import { paginateRest } from "@octokit/plugin-paginate-rest";
import { retry } from "@octokit/plugin-retry";
import { throttling } from "@octokit/plugin-throttling";
import { Octokit, RestEndpointMethodTypes } from "@octokit/rest";
import { PrismaClient, Visibility } from "@prisma/client";

import { logger } from "@/shared/lib/logger";
import { RepoItemFields } from "@/shared/types/repo-item";

const MyOctokit = Octokit.plugin(retry, throttling, paginateRest);
type SearchRepoItem =
  RestEndpointMethodTypes["search"]["repos"]["response"]["data"]["items"][number];
type ListRepoItem =
  RestEndpointMethodTypes["repos"]["listForAuthenticatedUser"]["response"]["data"][number];

type GitHubRepoResponse = SearchRepoItem | ListRepoItem;

export const githubService = {
  parseUrl(input: string) {
    if (!input) throw new Error("Field cannot be empty");

    const clean = input
      .trim()
      .replace(/^git@github\.com:/, "")
      .replace(/^(https?:\/\/)?(www\.)?github\.com\//, "")
      .replace(/\.git$/, "")
      .replace(/^\/+|\/+$/g, "");

    const parts = clean.split("/");

    const owner = parts[0]?.trim();
    const name = parts[1]?.trim();

    if (!owner || !name) {
      throw new Error("Invalid format. Enter 'owner/repo' or repository URL");
    }

    return { owner, name };
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

      if (limit !== undefined) {
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

  async getClientForUser(prisma: PrismaClient, userId: number) {
    const account = await prisma.account.findFirst({
      where: { userId, provider: "github" },
    });

    const token = account?.access_token;

    // if (token === null || token === undefined) {
    //   logger.error({ msg: "Token not found in DB", userId });
    //   throw new Error("TOKEN_MISSING");
    // }
    return new MyOctokit({
      auth: token,
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
};
