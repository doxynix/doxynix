import type { Repo } from "@prisma/client";

import { generateBranchName } from "@/shared/lib/get-branch-name";

import { appLogger } from "@/server/core/app-logger";
import type { DbClient } from "@/server/core/db";
import { getInstallationClient } from "@/server/core/github/github-provider";
import { resolveDocumentMaterializedPath } from "@/server/utils/document-materialization";

import { analysisRepo } from "../analysis.repository";
import { FixService } from "../logic/fix-generator";

export type GeneratedDocsData = {
  generatedApiMarkdown?: string;
  generatedArchitecture?: string;
  generatedChangelog?: string;
  generatedContributing?: string;
  generatedReadme?: string;
  swaggerYaml?: string;
};

export const docSyncService = {
  async autoSyncDocsToGithub(
    db: DbClient,
    repo: Repo,
    generatedDocsData: GeneratedDocsData,
    commitSha: string,
  ): Promise<null | { prNumber: number; prUrl: string }> {
    const fileChanges: Record<string, string> = {};

    if (generatedDocsData.generatedReadme != null) {
      fileChanges[resolveDocumentMaterializedPath({ sourcePath: null, type: "README" })] =
        generatedDocsData.generatedReadme;
    }
    if (generatedDocsData.generatedApiMarkdown != null) {
      fileChanges[resolveDocumentMaterializedPath({ sourcePath: null, type: "API" })] =
        generatedDocsData.generatedApiMarkdown;
    }
    if (generatedDocsData.generatedArchitecture != null) {
      fileChanges[resolveDocumentMaterializedPath({ sourcePath: null, type: "ARCHITECTURE" })] =
        generatedDocsData.generatedArchitecture;
    }
    if (generatedDocsData.generatedContributing != null) {
      fileChanges[resolveDocumentMaterializedPath({ sourcePath: null, type: "CONTRIBUTING" })] =
        generatedDocsData.generatedContributing;
    }
    if (generatedDocsData.generatedChangelog != null) {
      fileChanges[resolveDocumentMaterializedPath({ sourcePath: null, type: "CHANGELOG" })] =
        generatedDocsData.generatedChangelog;
    }

    const filePaths = Object.keys(fileChanges);
    if (filePaths.length === 0) {
      appLogger.info({
        msg: "No generated documentation files to sync to GitHub.",
        repoId: repo.id,
      });
      return null;
    }

    let fix: Awaited<ReturnType<typeof analysisRepo.create>> | null = null;

    try {
      const installation = await db.githubInstallation.findFirst({
        where: {
          accountLogin: { equals: repo.owner, mode: "insensitive" },
          isSuspended: false,
        },
      });

      if (installation == null) {
        appLogger.warn({
          msg: "GitHub App installation not found. Skipping automatic documentation PR.",
          repoId: repo.id,
        });
        return null;
      }

      const botOctokit = getInstallationClient(Number(installation.id));

      const branchName = generateBranchName();
      fix = await analysisRepo.create(db, {
        branch: branchName,
        createdByUser: false,
        description: `Automatically generated documentation update based on commit ${commitSha.slice(0, 7)}.`,
        repoId: repo.publicId,
        title: "Doxynix: Sync Project Documentation",
      });

      const fixService = new FixService();
      const result = await fixService.applyFix(botOctokit, {
        branch: branchName,
        defaultBranch: repo.defaultBranch,
        fixedFiles: Object.entries(fileChanges).map(([filePath, newContent]) => ({
          filePath,
          newContent,
        })),
        fixId: fix.publicId,
        owner: repo.owner,
        repoId: repo.publicId,
        repoName: repo.name,
        title: "📝 Doxynix: Sync latest project documentation",
      });

      await analysisRepo.updateStatus(db, fix.publicId, "PR_OPENED", {
        githubPrNumber: result.prNumber,
        githubPrUrl: result.prUrl,
      });

      appLogger.info({
        msg: "Documentation sync PR successfully opened on GitHub",
        prNumber: result.prNumber,
        repoId: repo.id,
      });

      return result;
    } catch (error) {
      if (fix != null) {
        await analysisRepo.updateStatus(db, fix.publicId, "FAILED").catch((dbError) => {
          appLogger.error({ error: dbError, msg: "Failed to update failed fix status in DB" });
        });
      }

      appLogger.error({
        error: error instanceof Error ? error.message : String(error),
        msg: "Failed to automatically sync documentation to GitHub.",
        repoId: repo.id,
      });
      return null;
    }
  },
};
