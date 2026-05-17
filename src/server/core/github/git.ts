import fs from "node:fs/promises";
import type { Repo } from "@prisma/client";
import gitUrlParse from "git-url-parse";
import simpleGit from "simple-git";

import { taskLogger } from "@/server/utils/task-logger";

import { prisma } from "../db";
import { executeWithFallback } from "./github-api";
import { GitHubAuthRequiredError, resolveClientContext } from "./github-provider";

const PRIVATE_REPO_AUTH_MESSAGE =
  "This is a private repository. Please install Doxynix App or connect GitHub.";

function assertPrivateRepoAccess(
  repo: Repo,
  clientType: "app" | "installation" | "oauth" | "public"
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
  userId: number,
  forceRefresh?: boolean
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
    where: { publicId: analysisId },
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
      throw new Error(PRIVATE_REPO_AUTH_MESSAGE);
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
    }
  );

  if (repo.visibility === "PRIVATE" && token == null) {
    taskLogger.error("GitHub: Unable to resolve token for private repository");
    throw new Error("Unable to resolve GitHub token for private repository.");
  }

  if (forceRefresh === false && lastSuccessfulAnalysis?.commitSha === currentSha) {
    taskLogger.info("GitHub: No new commits detected, using cached results");
    return { currentSha, repo: null, token };
  }

  taskLogger.success(`GitHub: Target commit identified as ${currentSha}`);

  return { currentSha, repo, token };
}

export async function cloneRepository(
  repo: Repo,
  token: null | string | undefined,
  targetPath: string,
  selectedBranch?: string
) {
  const branchToClone = selectedBranch ?? repo.defaultBranch;

  taskLogger.info(`Git: Initializing clone for ${repo.owner}/${repo.name} [${branchToClone}]...`);

  await fs.rm(targetPath, { force: true, recursive: true });
  await fs.mkdir(targetPath, { recursive: true });

  const git = simpleGit();
  const parsed = gitUrlParse(repo.url);
  const repoUrl = `https://${parsed.resource}/${parsed.full_name}.git`;

  const options = ["--filter=blob:none", "--single-branch", "--branch", branchToClone, "--no-tags"];
  if (token != null) {
    const basicAuth = Buffer.from(`x-access-token:${token}`).toString("base64");
    options.push("-c", `http.extraheader=Authorization: Basic ${basicAuth}`);
  }

  try {
    await git.clone(repoUrl, targetPath, options);
    await git.cwd(targetPath);

    taskLogger.success("Git: Repository cloned to local worker storage");
  } catch (error) {
    await fs.rm(targetPath, { force: true, recursive: true });

    const raw = error instanceof Error ? error.message : String(error);
    const safe = token != null ? raw.replaceAll(token, "***") : raw;
    taskLogger.error(`Git: Clone failed. ${safe}`);
    throw new Error(`Failed to clone repository: ${safe}`);
  }
}
