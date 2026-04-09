import type { RestEndpointMethodTypes } from "@octokit/rest";
import { Visibility, type Repo } from "@prisma/client";

import type { RepoItemFields } from "@/shared/types/repo.types";

import { ProjectPolicy } from "../../engine/core/project-policy";
import { isOctokitError } from "../../lib/handle-error";
import type { DbClient } from "../db";
import { logger } from "../logger";
import {
  getInstallationClient,
  getUserClient,
  GitHubAuthRequiredError,
  resolveClientContext,
  type OctokitInstance,
} from "./github-provider";

type SearchRepoItem =
  RestEndpointMethodTypes["search"]["repos"]["response"]["data"]["items"][number];
type ListRepoItem =
  RestEndpointMethodTypes["repos"]["listForAuthenticatedUser"]["response"]["data"][number];
type InstallationRepoItem =
  RestEndpointMethodTypes["apps"]["listReposAccessibleToInstallation"]["response"]["data"]["repositories"][number];
type GitHubRepoResponse = SearchRepoItem | ListRepoItem | InstallationRepoItem;
type GitHubContextType = "app" | "installation" | "oauth" | "public";
const FALLBACK_RETRYABLE_STATUSES = new Set([401, 403, 404]);
/**
 * Validates repository access and returns metadata
 * Throws GitHubAuthRequiredError for unauthorized access to private repos
 * Complexity: 6 branches
 */

async function getRepoDataOrAuthError(
  client: OctokitInstance,
  owner: string,
  name: string,
  type: GitHubContextType
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
/**
 * Transforms GitHub API repo objects to RepoItemFields
 */

export function mapRepos(data: GitHubRepoResponse[]): RepoItemFields[] {
  return data.map((repo) => ({
    description: repo.description ?? null,
    fullName: repo.full_name,
    language: repo.language ?? null,
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
    return mapRepos(repos as GitHubRepoResponse[]);
  } catch (error) {
    logger.error({ error, installationId, msg: "Failed installation fetch" });
    return [];
  }
}

async function fetchOauthRepos(account: { access_token: string | null; id: string | number }) {
  if (account.access_token == null) return [];
  try {
    const octokit = getUserClient(account.access_token);
    const repos = await octokit.paginate(octokit.rest.repos.listForAuthenticatedUser, {
      per_page: 100,
      visibility: "all",
    });
    return mapRepos(repos);
  } catch (error) {
    logger.error({ accountId: account.id, error, msg: "Failed OAuth fetch" });
    return [];
  }
}
/**
 * Lists all repositories accessible to user through:
 * - GitHub App installations
 * - OAuth tokens
 * Returns deduplicated list by fullName
 * Complexity: 8 branches
 */

export async function getMyRepos(prisma: DbClient, userId: number): Promise<RepoItemFields[]> {
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

    const installationTasks = installations.map((installation) =>
      fetchInstallationRepos(Number(installation.id))
    );
    const oauthTasks = oauthAccounts.map((account) => fetchOauthRepos(account));

    const results = await Promise.allSettled([...installationTasks, ...oauthTasks]);
    const allRepos = results.flatMap((result) =>
      result.status === "fulfilled" ? result.value : []
    );

    // Deduplicate by fullName
    return dedupeReposByFullName(allRepos);
  } catch (error) {
    logger.error({ error, msg: "Error fetching combined repositories", userId });
    return [];
  }
}
/**
 * Searches public/accessible repositories
 * For public contexts: filters to public repos only
 * Query length must be 2-256 chars
 * Complexity: 7 branches
 */

export async function searchRepos(
  prisma: DbClient,
  userId: number,
  query: string,
  limit: number | undefined
): Promise<RepoItemFields[]> {
  if (query.length < 2 || query.length > 256) return [];

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

    return items.map((repo) => ({
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
}
/**
 * Gets repository metadata (name, visibility, default branch, etc)
 * Validates access for public contexts
 * Retries with fallback on auth errors
 */

export async function getRepoInfo(prisma: DbClient, userId: number, owner: string, name: string) {
  const context = await resolveRepoClientContext(prisma, userId, owner);

  return executeWithFallback(prisma, userId, context.octokit, context.type, async (client) => {
    return await getRepoDataOrAuthError(client, owner, name, context.type);
  });
}
/**
 * Lists branch names for repository
 * For public contexts: validates repo access first
 * Pagination: 100 per page
 */

export async function getRepoBranches(
  prisma: DbClient,
  userId: number,
  owner: string,
  name: string
) {
  const context = await resolveRepoClientContext(prisma, userId, owner);

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
/**
 * Gets repository file tree (blob entries only, recursively)
 * Filters ignored files via ProjectPolicy
 * Returns: {path, sha, type}[]
 * Complexity: 8 branches (error handling)
 */

export async function getRepoTree(
  prisma: DbClient,
  userId: number,
  owner: string,
  name: string,
  branch?: string
) {
  const context = await resolveRepoClientContext(prisma, userId, owner);

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
            if (!item.path) return false;
            if (item.type !== "blob") return false;
            return !ProjectPolicy.isIgnored(item.path);
          })
          .map((item) => ({ path: item.path, sha: item.sha, type: item.type }));
      }
    );
  } catch (error) {
    if (isOctokitError(error)) {
      logger.info({ msg: "Repo empty or not found", status: error.status });
      return [];
    }
    logger.error({ error, msg: "Error fetching repo tree" });
    throw error;
  }
}
export type GitHubFileResponse = {
  content: string;
  meta: {
    name: string;
    sha: string;
    size: number;
    url: string | null;
  };
};
/**
 * Retrieves file content from repository
 * Decodes base64 response to UTF-8
 * Validates that path is a file (not directory)
 * Retries with fallback on auth errors
 */

export async function getFileContent(
  prisma: DbClient,
  userId: number,
  owner: string,
  name: string,
  path: string,
  branch?: string
): Promise<GitHubFileResponse> {
  const context = await resolveRepoClientContext(prisma, userId, owner);

  return await executeWithFallback(
    prisma,
    userId,
    context.octokit,
    context.type,
    async (client) => {
      const { data } = await client.rest.repos.getContent({
        owner,
        path,
        ref: branch,
        repo: name,
      });

      if (Array.isArray(data) || data.type !== "file") {
        throw new Error("Target path is not a file");
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
    }
  );
} /**
 * Executes operation with fallback retry on auth errors
 * For installation/oauth clients: tries available oauth tokens on 401/403/404
 * Cycles through all available oauth accounts
 * Complexity: 10 branches
 */

export async function executeWithFallback<T>(
  prisma: DbClient,
  userId: number,
  initialOctokit: OctokitInstance,
  initialType: GitHubContextType,
  operation: (client: OctokitInstance) => Promise<T>
): Promise<T> {
  try {
    return await operation(initialOctokit);
  } catch (error) {
    if (shouldRetryWithOauthFallback(initialType, error)) {
      // Fetch all available oauth accounts
      const oauthAccounts = await prisma.account.findMany({
        where: { access_token: { not: null }, provider: "github", userId },
      });

      // Try each oauth account
      for (const oauthAcc of oauthAccounts) {
        if (oauthAcc.access_token == null) continue;

        try {
          const fallbackOctokit = getUserClient(oauthAcc.access_token);
          return await operation(fallbackOctokit);
        } catch (fallbackError) {
          logger.error({ error: fallbackError, msg: "Token didn't work in fallback" });
          continue;
        }
      }
    }

    throw error;
  }
}
export type BusFactorResult = {
  busFactor: number;
  rawContributors: Array<{
    contributions: number;
    login: string;
  }>;
};
/**
 * Calculates bus factor for repository
 * - Fetches contributors (max 500)
 * - Sorts by commit count
 * - Finds minimum team size for 50% of commits
 * - Validates private repo access
 * Complexity: 12 branches (error handling + auth)
 */

export async function calculateBusFactor(
  repo: Repo,
  userId: number,
  prisma: DbClient
): Promise<BusFactorResult> {
  try {
    const context = await resolveRepoClientContext(prisma, userId, repo.owner);

    const octokit = context.octokit;
    const clientType = context.type;

    // Validate private repo access
    if (repo.visibility === "PRIVATE" && (clientType === "app" || clientType === "public")) {
      throw new GitHubAuthRequiredError();
    }

    const contributors = await executeWithFallback(
      prisma,
      userId,
      octokit,
      clientType,
      async (client) => {
        let fetchedContributors = 0;

        return await client.paginate(
          client.rest.repos.listContributors,
          { owner: repo.owner, per_page: 100, repo: repo.name },
          (
            response: Awaited<ReturnType<OctokitInstance["rest"]["repos"]["listContributors"]>>,
            done: () => void
          ) => {
            fetchedContributors += response.data.length;
            if (fetchedContributors >= 500) done();
            return response.data;
          }
        );
      }
    );

    // Normalize and sort contributors
    const rawContributors = contributors
      .map((contributor: (typeof contributors)[number]) => ({
        contributions: contributor.contributions,
        login: contributor.login ?? "unknown",
      }))
      .sort((left, right) => right.contributions - left.contributions);

    const totalCommits = rawContributors.reduce(
      (acc: number, contributor) => acc + contributor.contributions,
      0
    );

    if (totalCommits === 0) {
      return {
        busFactor: 0,
        rawContributors,
      };
    }

    // Calculate bus factor: min team size for 50% of commits
    let runningSum = 0;
    let busFactor = 0;

    for (const contributor of rawContributors) {
      runningSum += contributor.contributions;
      busFactor++;
      if (runningSum >= totalCommits * 0.5) break;
    }

    return {
      busFactor,
      rawContributors,
    };
  } catch (error) {
    // Extract HTTP status if available
    const status =
      typeof error === "object" && error !== null && "status" in error
        ? Number((error as { status?: number }).status)
        : undefined;

    const isMissingAuth = error instanceof GitHubAuthRequiredError;

    // Private repo requires auth
    if (repo.visibility === "PRIVATE" && (isMissingAuth || isRetryableGithubStatus(status))) {
      if (isMissingAuth) throw error;
      throw new GitHubAuthRequiredError();
    }

    // Public repo: log and return default
    if (isMissingAuth || isRetryableGithubStatus(status)) {
      logger.warn({
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

async function resolveRepoClientContext(prisma: DbClient, userId: number, owner: string) {
  return resolveClientContext(prisma, userId, {
    allowPublicFallback: true,
    allowSystemFallback: true,
    owner,
  });
}
