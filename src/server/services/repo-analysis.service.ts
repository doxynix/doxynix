import type { DocType } from "@prisma/client";
import { tasks } from "@trigger.dev/sdk/v3";
import { TRPCError } from "@trpc/server";

import type { DbClient } from "@/server/db/db";

export const repoAnalysisService = {
  async analyze(
    db: DbClient,
    userId: number,
    input: {
      branch?: string;
      docTypes: DocType[];
      files: string[];
      instructions?: string;
      language: string;
      repoId: string;
    }
  ) {
    const repo = await db.repo.findUnique({
      where: { publicId: input.repoId },
    });

    if (repo == null) throw new TRPCError({ code: "NOT_FOUND", message: "Repository not found" });

    const analysis = await db.analysis.create({
      data: {
        repo: {
          connect: {
            publicId: input.repoId,
          },
        },
        status: "PENDING",
      },
    });

    const handle = await tasks.trigger(
      "analyze-repo",
      {
        analysisId: analysis.publicId,
        docTypes: input.docTypes,
        instructions: input.instructions,
        language: input.language,
        selectedBranch: input.branch,
        selectedFiles: input.files,
        userId,
      },
      {
        concurrencyKey: `user-${userId}`,
        idempotencyKey: `analysis-${analysis.publicId}`,
        ttl: "30m",
      }
    );

    await db.analysis.update({
      data: { jobId: handle.id },
      where: { publicId: analysis.publicId },
    });

    return { jobId: handle.id, status: "QUEUED" };
  },

  async analyzeFile(
    db: DbClient,
    userId: number,
    input: {
      content: string;
      language: string;
      path: string;
      repoId: string;
    }
  ) {
    const repo = await db.repo.findFirst({
      where: { publicId: input.repoId, userId },
    });

    if (repo == null) throw new TRPCError({ code: "NOT_FOUND" });

    const handle = await tasks.trigger(
      "analyze-single-file",
      {
        content: input.content,
        language: input.language,
        path: input.path,
        repoId: input.repoId,
      },
      {
        concurrencyKey: `user-${userId}`,
        idempotencyKey: `analyze-file-${input.repoId}-${input.path}`,
        ttl: "10m",
      }
    );

    return { jobId: handle.id };
  },

  async documentFile(
    db: DbClient,
    userId: number,
    input: {
      content: string;
      language: string;
      path: string;
      repoId: string;
    }
  ) {
    const repo = await db.repo.findUnique({
      where: { publicId: input.repoId, userId },
    });

    if (repo == null) throw new TRPCError({ code: "NOT_FOUND" });

    const handle = await tasks.trigger(
      "document-single-file",
      {
        content: input.content,
        language: input.language,
        path: input.path,
        repoId: input.repoId,
        userId,
      },
      {
        concurrencyKey: `user-${userId}`,
        idempotencyKey: `doc-file-${input.repoId}-${input.path}`,
        ttl: "10m",
      }
    );

    return { jobId: handle.id };
  },
};
