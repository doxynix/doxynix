import type { Repo } from "@prisma/client";

import { prisma } from "@/server/core/db";
import { shouldUseCache } from "@/server/core/github/git";
import { executeWithFallback } from "@/server/core/github/github-api";
import {
  GitHubAuthRequiredError,
  resolveClientContext,
} from "@/server/core/github/github-provider";
import { taskLogger } from "@/server/modules/analysis/logic/task-logger";

const PRIVATE_REPO_AUTH_MESSAGE =
  "This is a private repository. Please install Doxynix App or connect GitHub.";

function assertPrivateRepoAccess(
  repo: Repo,
  clientType: "app" | "installation" | "oauth" | "public",
) {
  if (repo.visibility === "PRIVATE" && (clientType === "app" || clientType === "public")) {
    throw new Error(PRIVATE_REPO_AUTH_MESSAGE);
  }
}

async function resolveAuthToken(client: {
  auth: (() => Promise<unknown>) & ((options?: unknown) => Promise<unknown>);
}): Promise<null | string> {
  try {
    const auth = (await client.auth({ type: "installation" })) as { token?: string };
    return auth.token ?? null;
  } catch {
    try {
      const auth = (await client.auth()) as { token?: string };
      return auth.token ?? null;
    } catch {
      return null;
    }
  }
}

export async function getAnalysisContext(
  analysisId: string,
  userId: string,
  forceRefresh?: boolean,
) {
  taskLogger.info(`GitHub: Accessing database...`);

  const analysis = await prisma.analysis.findUnique({
    include: {
      repo: {
        include: {
          analyses: {
            orderBy: { createdAt: "desc" },
            take: 1,
            where: { status: "DONE" },
          },
        },
      },
    },
    where: { id: analysisId },
  });

  if (analysis == null) {
    taskLogger.error("GitHub: Analysis record not found");
    throw new Error("Analysis not found");
  }

  const repo = analysis.repo;
  const lastSuccessfulAnalysis = repo.analyses[0];

  let octokit;
  let clientType: "app" | "installation" | "oauth" | "public";

  taskLogger.info(`GitHub: Resolving credentials for ${repo.owner}/${repo.name}...`);

  try {
    const clientContext = await resolveClientContext(prisma, userId, {
      allowPublicFallback: true,
      allowSystemFallback: true,
      owner: repo.owner,
    });
    octokit = clientContext.octokit;
    clientType = clientContext.type;
  } catch (error) {
    if (error instanceof GitHubAuthRequiredError) {
      taskLogger.error("GitHub: Authentication required for this repository");
      throw new Error(PRIVATE_REPO_AUTH_MESSAGE, { cause: error });
    }
    throw error;
  }

  assertPrivateRepoAccess(repo, clientType);
  taskLogger.info(`GitHub: Fetching latest commit info for branch: ${repo.defaultBranch}...`);

  const { currentSha, token } = await executeWithFallback(
    prisma,
    userId,
    octokit,
    clientType,
    async (client) => {
      const { data: refData } = await client.rest.git.getRef({
        owner: repo.owner,
        ref: `heads/${repo.defaultBranch}`,
        repo: repo.name,
      });

      const resolvedToken = await resolveAuthToken(client);
      return { currentSha: refData.object.sha, token: resolvedToken };
    },
  );

  if (repo.visibility === "PRIVATE" && token == null) {
    taskLogger.error("GitHub: Unable to resolve token for private repository");
    throw new Error("Unable to resolve GitHub token for private repository.");
  }

  if (
    shouldUseCache({
      currentSha,
      forceRefresh,
      lastSuccessfulSha: lastSuccessfulAnalysis?.commitSha ?? undefined,
    })
  ) {
    taskLogger.info("GitHub: No new commits detected, using cached results");
    return { currentSha, repo: null, token };
  }

  taskLogger.success(`GitHub: Target commit identified as ${currentSha}`);

  return { currentSha, repo, token };
}
