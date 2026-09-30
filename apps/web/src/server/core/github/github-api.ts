import { Visibility } from "@doxynix/shared";
import type { RestEndpointMethodTypes } from "@octokit/rest";
import type { Repo } from "@prisma/client";
import { sumBy } from "es-toolkit";

import type { RepoItemFields } from "@/shared/api/repo.types";

import { ProjectPolicy } from "@/server/modules/analysis/engine/core/project-policy";
import { taskLogger } from "@/server/modules/analysis/logic/task-logger";
import { AppError } from "@/server/utils/api-error";
import { isOctokitError } from "@/server/utils/handle-error";
import { getLanguageColor } from "@/server/utils/language-metadata";

import { appLogger } from "../app-logger";
import type { DbClient } from "../db";
import {
  GitHubAuthRequiredError,
  getInstallationClient,
  getPublicClient,
  type OctokitInstance,
  resolveClientContext,
} from "./github-provider";

type SearchRepoItem =
  RestEndpointMethodTypes["search"]["repos"]["response"]["data"]["items"][number];
type InstallationRepoItem =
  RestEndpointMethodTypes["apps"]["listReposAccessibleToInstallation"]["response"]["data"]["repositories"][number];
type GitHubRepoResponse = InstallationRepoItem | SearchRepoItem;
type GitHubContextType = "app" | "installation" | "oauth" | "public";
const FALLBACK_RETRYABLE_STATUSES = new Set([401, 403, 404]);

async function getRepoDataOrAuthError(
  client: OctokitInstance,
  owner: string,
  name: string,
  type: GitHubContextType,
) {
  const isPublicContext = type === "app" || type === "public";

  try {
    const { data } = await client.rest.repos.get({ owner, repo: name });

    if (isPublicContext && data.private) {
      throw new GitHubAuthRequiredError();
    }

    return data;
  } catch (error) {
    if (isPublicContext && isOctokitError(error) && error.status === 403) {
      throw new GitHubAuthRequiredError();
    }
    throw error;
  }
}

export function mapRepos(data: GitHubRepoResponse[]): RepoItemFields[] {
  return data.map((repo) => ({
    description: repo.description ?? null,
    fullName: repo.full_name,
    language: repo.language ?? null,
    languageColor: getLanguageColor(repo.language),
    stars: repo.stargazers_count,
    updatedAt: repo.updated_at ?? new Date().toISOString(),
    visibility: repo.private ? Visibility.PRIVATE : Visibility.PUBLIC,
  }));
}

function dedupeReposByFullName(repos: RepoItemFields[]) {
  return Array.from(new Map(repos.map((repo) => [repo.fullName, repo])).values());
}

async function fetchInstallationRepos(installationId: number): Promise<RepoItemFields[]> {
  try {
    const octokit = getInstallationClient(installationId);
    const repos = await octokit.paginate(octokit.rest.apps.listReposAccessibleToInstallation);
    return mapRepos(repos);
  } catch (error) {
    appLogger.error({ error, installationId, msg: "Failed installation fetch" });
    return [];
  }
}

async function fetchOauthRepos(account: { accessToken: null | string; id: string }) {
  if (account.accessToken == null) {
    return [];
  }
  try {
    const octokit = getPublicClient(account.accessToken);
    const repos = await octokit.paginate(octokit.rest.repos.listForAuthenticatedUser, {
      per_page: 100,
      visibility: "all",
    });
    return mapRepos(repos);
  } catch (error) {
    appLogger.error({ accountId: account.id, error, msg: "Failed OAuth fetch" });
    return [];
  }
}

export async function getMyRepos(prisma: DbClient, userId: string): Promise<RepoItemFields[]> {
  try {
    const [installations, oauthAccounts] = await Promise.all([
      prisma.githubInstallation.findMany({
        where: { isSuspended: false, userId },
      }),
      prisma.account.findMany({
        where: { accessToken: { not: null }, providerId: "github", userId },
      }),
    ]);

    if (installations.length === 0 && oauthAccounts.length === 0) {
      return [];
    }

    const installationTasks = installations.map((installation) =>
      fetchInstallationRepos(Number(installation.id)),
    );
    const oauthTasks = oauthAccounts.map((account) => fetchOauthRepos(account));

    const results = await Promise.allSettled([...installationTasks, ...oauthTasks]);
    const allRepos = results.flatMap((result) =>
      result.status === "fulfilled" ? result.value : [],
    );

    return dedupeReposByFullName(allRepos);
  } catch (error) {
    appLogger.error({ error, msg: "Error fetching combined repositories", userId });
    return [];
  }
}

export async function searchRepos(
  prisma: DbClient,
  userId: string,
  query: string,
  limit: number | undefined,
): Promise<RepoItemFields[]> {
  if (query.length < 2 || query.length > 256) {
    return [];
  }

  const context = await resolveClientContext(prisma, userId, {
    allowPublicFallback: true,
    allowSystemFallback: true,
  });

  const octokit = context.octokit;
  const queryWithVisibility =
    context.type === "app" || context.type === "public" ? `${query} is:public` : query;

  try {
    const { data } = await octokit.rest.search.repos({
      per_page: limit ?? 10,
      q: queryWithVisibility,
    });

    const items =
      context.type === "app" || context.type === "public"
        ? data.items.filter((repo) => !repo.private)
        : data.items;

    return mapRepos(items);
  } catch (error) {
    appLogger.error({ error, msg: "GitHub search error" });
    return [];
  }
}

export async function getRepoInfo(prisma: DbClient, userId: string, owner: string, name: string) {
  const context = await resolveClientContext(prisma, userId, {
    allowPublicFallback: true,
    allowSystemFallback: true,
    owner,
  });

  return executeWithFallback(prisma, userId, context.octokit, context.type, async (client) => {
    return getRepoDataOrAuthError(client, owner, name, context.type);
  });
}

export async function getRepoBranches(
  prisma: DbClient,
  userId: string,
  owner: string,
  name: string,
) {
  const context = await resolveClientContext(prisma, userId, {
    allowPublicFallback: true,
    allowSystemFallback: true,
    owner,
  });

  return executeWithFallback(prisma, userId, context.octokit, context.type, async (client) => {
    if (context.type === "app" || context.type === "public") {
      await getRepoDataOrAuthError(client, owner, name, context.type);
    }

    const branches = await client.paginate(client.rest.repos.listBranches, {
      owner,
      per_page: 100,
      repo: name,
    });

    return branches.map((b) => b.name);
  });
}

export async function getRepoTree(
  prisma: DbClient,
  userId: string,
  owner: string,
  name: string,
  branch?: string,
) {
  const context = await resolveClientContext(prisma, userId, {
    allowPublicFallback: true,
    allowSystemFallback: true,
    owner,
  });

  try {
    return await executeWithFallback(
      prisma,
      userId,
      context.octokit,
      context.type,
      async (client) => {
        const repoData = await getRepoDataOrAuthError(client, owner, name, context.type);
        const treeSha = branch ?? repoData.default_branch;

        const { data } = await client.rest.git.getTree({
          owner,
          recursive: "1",
          repo: name,
          tree_sha: treeSha,
        });

        return data.tree
          .filter((item) => {
            if (!item.path) {
              return false;
            }
            if (item.type !== "blob") {
              return false;
            }
            return !ProjectPolicy.isIgnored(item.path);
          })
          .map((item) => ({ path: item.path, sha: item.sha, type: item.type }));
      },
    );
  } catch (error) {
    if (isOctokitError(error)) {
      appLogger.info({ msg: "Repo empty or not found", status: error.status });
      return [];
    }
    appLogger.error({ error, msg: "Error fetching repo tree" });
    throw error;
  }
}
type GitHubFileResponse = {
  content: string;
  meta: {
    name: string;
    sha: string;
    size: number;
    url: null | string;
  };
};

export async function getFileContent(
  prisma: DbClient,
  userId: string,
  owner: string,
  name: string,
  path: string,
  branch?: string,
): Promise<GitHubFileResponse> {
  const context = await resolveClientContext(prisma, userId, {
    allowPublicFallback: true,
    allowSystemFallback: true,
    owner,
  });

  return executeWithFallback(prisma, userId, context.octokit, context.type, async (client) => {
    const { data } = await client.rest.repos.getContent({
      owner,
      path,
      ref: branch,
      repo: name,
    });

    if (Array.isArray(data) || data.type !== "file") {
      // Typed so the caller gets a 400 with an explanation instead of a masked 500; reachable from the browse route and the agent file tools alike.
      throw new AppError({ code: "BAD_REQUEST", publicMessage: "Target path is not a file" });
    }

    return {
      content: Buffer.from(data.content, "base64").toString("utf8"),
      meta: {
        name: data.name,
        sha: data.sha,
        size: data.size,
        url: data.html_url,
      },
    };
  });
}

// Retries with each available OAuth token on 401/403/404 for installation/oauth clients.
export async function executeWithFallback<T>(
  prisma: DbClient,
  userId: string,
  initialOctokit: OctokitInstance,
  initialType: GitHubContextType,
  operation: (client: OctokitInstance) => Promise<T>,
): Promise<T> {
  try {
    return await operation(initialOctokit);
  } catch (error) {
    if (shouldRetryWithOauthFallback(initialType, error)) {
      const oauthAccounts = await prisma.account.findMany({
        where: { accessToken: { not: null }, providerId: "github", userId },
      });

      for (const oauthAcc of oauthAccounts) {
        if (oauthAcc.accessToken == null) {
          continue;
        }

        try {
          const fallbackOctokit = getPublicClient(oauthAcc.accessToken);
          return await operation(fallbackOctokit);
        } catch (fallbackError) {
          appLogger.error({ error: fallbackError, msg: "Token didn't work in fallback" });
        }
      }
    }

    throw error;
  }
}

type BusFactorResult = {
  busFactor: number;
  rawContributors: Array<{
    contributions: number;
    login: string;
  }>;
};

export async function calculateBusFactor(
  repo: Repo,
  userId: string,
  prisma: DbClient,
): Promise<BusFactorResult> {
  taskLogger.info("GitHub: Analyzing contributor history to calculate Bus Factor...");

  try {
    const context = await resolveClientContext(prisma, userId, {
      allowPublicFallback: true,
      allowSystemFallback: true,
      owner: repo.owner,
    });

    const octokit = context.octokit;
    const clientType = context.type;

    if (repo.visibility === "PRIVATE" && (clientType === "app" || clientType === "public")) {
      taskLogger.error("GitHub: Private repository access denied (missing installation)");
      throw new GitHubAuthRequiredError();
    }

    const contributors = await executeWithFallback(
      prisma,
      userId,
      octokit,
      clientType,
      async (client) => {
        let fetchedContributors = 0;

        return client.paginate(
          client.rest.repos.listContributors,
          { owner: repo.owner, per_page: 100, repo: repo.name },
          (
            response: Awaited<ReturnType<OctokitInstance["rest"]["repos"]["listContributors"]>>,
            done: () => void,
          ) => {
            fetchedContributors += response.data.length;
            if (fetchedContributors >= 500) {
              done();
            }
            return response.data;
          },
        );
      },
    );

    taskLogger.info(`GitHub: Successfully retrieved ${contributors.length} active contributors`);

    const rawContributors = contributors
      .map((contributor: (typeof contributors)[number]) => ({
        contributions: contributor.contributions,
        login: contributor.login ?? "unknown",
      }))
      .sort((left, right) => right.contributions - left.contributions);

    const totalCommits = sumBy(rawContributors, (c) => c.contributions);

    if (totalCommits === 0) {
      taskLogger.warn("GitHub: No commit history found for this repository");
      return {
        busFactor: 0,
        rawContributors,
      };
    }

    let runningSum = 0;
    let busFactor = 0;

    for (const contributor of rawContributors) {
      runningSum += contributor.contributions;
      busFactor++;
      if (runningSum >= totalCommits * 0.5) {
        break;
      }
    }

    taskLogger.success(
      `GitHub: Bus Factor is ${busFactor}. Knowledge is ${
        busFactor > 2 ? "distributed across the team" : "concentrated in few key people"
      }.`,
    );

    return {
      busFactor,
      rawContributors,
    };
  } catch (error) {
    const status =
      typeof error === "object" && error !== null && "status" in error
        ? Number((error as { status?: number }).status)
        : undefined;

    const isMissingAuth = error instanceof GitHubAuthRequiredError;

    if (repo.visibility === "PRIVATE" && (isMissingAuth || isRetryableGithubStatus(status))) {
      taskLogger.error("GitHub: Failed to access private repository contributors");
      if (isMissingAuth) {
        throw error;
      }
      throw new GitHubAuthRequiredError();
    }

    if (isMissingAuth || isRetryableGithubStatus(status)) {
      taskLogger.warn(
        "GitHub: Bus Factor calculation failed (likely due to API limits). Defaulting to 0.",
      );

      appLogger.warn({
        error,
        msg: "Failed to fetch contributors for Bus Factor calculation. Defaulting to 0.",
        repoId: repo.id,
      });
      return { busFactor: 0, rawContributors: [] };
    }

    throw error;
  }
}

function isRetryableGithubStatus(status: number | undefined) {
  return status != null && FALLBACK_RETRYABLE_STATUSES.has(status);
}

function shouldRetryWithOauthFallback(initialType: GitHubContextType, error: unknown) {
  return (
    (initialType === "installation" || initialType === "oauth") &&
    isOctokitError(error) &&
    isRetryableGithubStatus(error.status)
  );
}
