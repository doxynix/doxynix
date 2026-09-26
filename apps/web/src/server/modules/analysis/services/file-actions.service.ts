import { unstable_cache } from "next/cache";
import { tasks } from "@trigger.dev/sdk";
import type { Redis } from "@upstash/redis";
import * as z from "zod";

import type { DbClient } from "@/server/core/db";
import { redisService } from "@/server/core/redis";
import { markdownToHtml } from "@/server/utils/markdown-to-html";

import type { NodeContext } from "../analysis.context";
import { analysisContext } from "../analysis.context";
import type { AnalysisRef } from "../analysis.repository";
import { analysisRepo } from "../analysis.repository";
import type { FileActionNodeContext } from "../analysis.schemas";
import { buildSyncFileActionMeta } from "../logic/repo-file-action-state";
import { analysisLifecycleService } from "./analysis-lifecycle.service";

export const FileActionResult = z.enum(["document-file-preview", "quick-file-audit"]);

export type FileActionRequest = {
  analysisId?: string;
  branch: string;
  commitSha?: string;
  content: string;
  language: string;
  nodeContext?: FileActionNodeContext | NodeContext;
  nodeId?: string;
  path: string;
  repoId: string;
};

export const fileActionsService = {
  async buildFileActionRuntimeContext(db: DbClient, input: { nodeId?: string; repoId: string }) {
    const [nodeContext, analysisRef] = await Promise.all([
      analysisContext.build(db, input.repoId, input.nodeId),
      analysisRepo.getLatestRef(db, input.repoId),
    ]);

    return { analysisRef, nodeContext };
  },

  buildSyncFileMeta(
    input: { analysisId?: string; commitSha?: string },
    nodeContext: NodeContext | null,
    analysisRef: AnalysisRef | null,
  ) {
    return buildSyncFileActionMeta({
      analysisRef,
      contentRef: {
        analysisId: input.analysisId,
        commitSha: input.commitSha,
      },
      contextDiagnostics: analysisContext.getDiagnostics(nodeContext),
      contextMeta: analysisContext.getMeta(nodeContext),
    });
  },

  async documentFile(db: DbClient, userId: number, input: FileActionRequest) {
    return this.runFileAction(db, userId, "document-single-file", input);
  },

  async getFileActionResult(
    redis: Redis,
    userId: string,
    input: { action: z.infer<typeof FileActionResult>; path: string },
  ) {
    const data = await redisService.fileActions.get(userId, input.path, input.action);

    if (data == null) {
      return null;
    }

    const html = await unstable_cache(
      async () => markdownToHtml({ content: data.content }),
      [`file-res-html-${userId}-${input.action}-${input.path}`],
      { revalidate: false, tags: ["file-audit", `file-audit-${userId}`] },
    )();

    return {
      ...data,
      html,
    };
  },

  async quickFileAudit(db: DbClient, userId: number, input: FileActionRequest) {
    return this.runFileAction(db, userId, "analyze-single-file", input);
  },

  async runFileAction(
    db: DbClient,
    userId: number,
    taskId: "analyze-single-file" | "document-single-file",
    input: FileActionRequest,
  ) {
    await analysisLifecycleService.assertRepoAccess(db, userId, input.repoId);

    const { analysisRef, nodeContext } = await this.buildFileActionRuntimeContext(db, input);

    const syncMeta = this.buildSyncFileMeta(input, nodeContext, analysisRef);

    const handle = await tasks.trigger(
      taskId,
      {
        content: input.content,
        language: input.language,
        nodeContext: nodeContext ?? undefined,
        path: input.path,
        repoId: input.repoId,
        syncMeta,
        userId,
      },
      {
        // concurrencyKey: `user-${userId}`,
        // idempotencyKey: `${taskId}-${input.repoId}-${input.path}`,
        ttl: "10m",
      },
    );

    return { jobId: handle.id };
  },
};
