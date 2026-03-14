import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import type { Repo } from "@prisma/client";
import simpleGit from "simple-git";

import { prisma } from "@/server/db/db";
import { GitHubAuthRequiredError, githubService } from "@/server/services/github.service";

export async function getAnalysisContext(
  analysisId: string,
  userId: number,
  forceRefresh?: boolean
) {
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

  if (analysis == null) throw new Error("Analysis not found");

  const repo = analysis.repo;
  const lastSuccessfulAnalysis = repo.analyses[0];

  let octokit;
  let clientType: "installation" | "oauth" | "app" | "public";

  try {
    const clientContext = await githubService.resolveClientContext(prisma, userId, {
      allowPublicFallback: true,
      allowSystemFallback: true,
      owner: repo.owner,
    });
    octokit = clientContext.octokit;
    clientType = clientContext.type;
  } catch (error) {
    if (error instanceof GitHubAuthRequiredError) {
      throw new Error(
        "This is a private repository. Please install Doxynix App or connect GitHub."
      );
    }
    throw error;
  }

  if (repo.visibility === "PRIVATE" && (clientType === "app" || clientType === "public")) {
    throw new Error("This is a private repository. Please install Doxynix App or connect GitHub.");
  }

  const { currentSha, token } = await githubService.executeWithFallback(
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

      let resolvedToken: string | null = null;
      try {
        const auth = (await client.auth({ type: "installation" })) as { token?: string };
        resolvedToken = auth.token ?? null;
      } catch {
        try {
          const auth = (await client.auth()) as { token?: string };
          resolvedToken = auth.token ?? null;
        } catch {
          resolvedToken = null;
        }
      }

      return { currentSha: refData.object.sha, token: resolvedToken };
    }
  );

  if (repo.visibility === "PRIVATE" && token == null) {
    throw new Error("Unable to resolve GitHub token for private repository.");
  }

  if (forceRefresh === false && lastSuccessfulAnalysis.commitSha === currentSha) {
    return { currentSha, repo: null, token };
  }

  return { currentSha, repo, token };
}

export async function cloneRepository(
  repo: Repo,
  token: string | undefined | null,
  targetPath: string,
  selectedBranch?: string
) {
  if (existsSync(targetPath)) {
    await fs.rm(targetPath, { force: true, recursive: true });
  }
  await fs.mkdir(targetPath, { recursive: true });

  const git = simpleGit();
  const branchToClone = selectedBranch ?? repo.defaultBranch;

  const repoUrl = `https://github.com/${repo.owner}/${repo.name}.git`;

  const options = ["--depth", "1", "--branch", branchToClone];

  if (token != null) {
    const base64Auth = Buffer.from(`x-access-token:${token}`).toString("base64");

    options.push("-c", `http.extraheader=AUTHORIZATION: basic ${base64Auth}`);
  }

  await git.clone(repoUrl, targetPath, options);
}
