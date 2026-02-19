import { existsSync } from "fs";
import fs from "fs/promises";
import simpleGit from "simple-git";

import { prisma } from "@/shared/api/db/db";
import { SYSTEM_TOKEN } from "@/shared/constants/env.server";

import { Repo, StatusSchema, VisibilitySchema } from "@/generated/zod";
import { githubService } from "@/server/services/github.service";

export async function getAnalysisContext(
  analysisId: string,
  userId: number,
  forceRefresh?: boolean
) {
  const analysis = await prisma.analysis.findUnique({
    where: { publicId: analysisId },
    include: {
      repo: {
        include: {
          analyses: {
            where: { status: StatusSchema.enum.DONE },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      },
    },
  });

  if (!analysis) throw new Error("Analysis not found");

  const repo = analysis.repo;
  const lastSuccessfulAnalysis = repo.analyses[0];

  const account = await prisma.account.findFirst({ where: { userId, provider: "github" } });
  const userToken = account?.access_token;
  if (repo.visibility === VisibilitySchema.enum.PRIVATE && userToken == null) {
    throw new Error("This is a private repository. Please connect your GitHub account.");
  }

  const token = userToken ?? SYSTEM_TOKEN;
  const octokit = await githubService.getClientForUser(prisma, userId);

  const { data: refData } = await octokit.git.getRef({
    owner: repo.owner,
    repo: repo.name,
    ref: `heads/${repo.defaultBranch}`,
  });

  const currentSha = refData.object.sha;

  if (forceRefresh === false && lastSuccessfulAnalysis?.commitSha === currentSha) {
    return { repo: null, token, currentSha };
  }

  return { repo, token, currentSha };
}

export async function cloneRepository(
  repo: Repo,
  token: string | undefined | null,
  targetPath: string,
  selectedBranch?: string
) {
  if (existsSync(targetPath)) {
    await fs.rm(targetPath, { recursive: true, force: true });
  }
  await fs.mkdir(targetPath, { recursive: true });

  const git = simpleGit();
  const branchToClone = selectedBranch ?? repo.defaultBranch;

  const repoUrl = `https://github.com/${repo.owner}/${repo.name}.git`;

  const options = ["--depth", "1", "--branch", branchToClone];

  if (token !== null) {
    const base64Auth = Buffer.from(`x-access-token:${token}`).toString("base64");

    options.push("-c", `http.extraheader=AUTHORIZATION: basic ${base64Auth}`);
  }

  await git.clone(repoUrl, targetPath, options);
}
