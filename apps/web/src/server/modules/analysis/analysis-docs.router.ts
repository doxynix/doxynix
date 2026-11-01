import { DocTypeSchema } from "@doxynix/shared";
import * as z from "zod";

import { protectedProcedure, workspaceProcedure } from "@/server/core/trpc/init";

import { AnalysisScopeInputSchema } from "./analysis.schemas";
import {
  docsService,
  GetWithGraphLinksInput,
  GetWithGraphLinksOutput,
  PinAuditToDocsOutput,
} from "./services/docs.service";
import { FileActionResult, fileActionsService } from "./services/file-actions.service";

const DEFAULT_DOC_LANGUAGE = "English";

const FileActionInputSchema = z.object({
  analysisId: z.uuid().optional(),
  branch: z.string(),
  commitSha: z.string().optional(),
  content: z.string(),
  language: z.string().default(DEFAULT_DOC_LANGUAGE),
  nodeId: z.string().optional(),
  path: z.string(),
  repoId: z.uuid(),
});

export const analysisDocsRouter = {
  documentFile: workspaceProcedure.input(FileActionInputSchema).mutation(async ({ ctx, input }) => {
    return fileActionsService.documentFile(ctx.db, ctx.session.user.id, input, ctx.workspace.id);
  }),
  getAvailableDocs: workspaceProcedure
    .input(AnalysisScopeInputSchema)
    .query(async ({ ctx, input }) => {
      return docsService.getAvailableDocs(ctx.db, input.repoId, ctx.workspace.id, input.aid);
    }),
  getDocumentContent: workspaceProcedure
    .input(
      z.object({
        aid: z.string().optional(),
        path: z.string().optional(),
        repoId: z.uuid(),
        type: DocTypeSchema,
      }),
    )
    .query(async ({ ctx, input }) => {
      return docsService.getDocumentContent(
        ctx.db,
        input.repoId,
        input.type,
        ctx.workspace.id,
        input.aid,
        input.path,
      );
    }),
  getFileActionResult: protectedProcedure
    .input(
      z.object({
        action: FileActionResult,
        path: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      return fileActionsService.getFileActionResult(ctx.redis, ctx.session.user.id, input);
    }),
  getWithGraphLinks: workspaceProcedure
    .input(GetWithGraphLinksInput)
    .output(GetWithGraphLinksOutput)
    .query(async ({ ctx, input }) => {
      return docsService.getWithGraphLinks(ctx.db, input, ctx.workspace.id);
    }),
  highlightFile: protectedProcedure
    .input(z.object({ content: z.string(), path: z.string() }))
    .query(async ({ input }) => {
      return docsService.highlightFile(input.content, input.path);
    }),
  pinAuditToDocs: workspaceProcedure
    .input(
      z.object({
        path: z.string(),
        repoId: z.uuid(),
      }),
    )
    .output(PinAuditToDocsOutput)
    .mutation(async ({ ctx, input }) => {
      return docsService.pinAuditToDocs(
        ctx.db,
        ctx.redis,
        ctx.session.user.id,
        input,
        ctx.workspace.id,
      );
    }),
  quickFileAudit: workspaceProcedure
    .input(FileActionInputSchema)
    .mutation(async ({ ctx, input }) => {
      return fileActionsService.quickFileAudit(
        ctx.db,
        ctx.session.user.id,
        input,
        ctx.workspace.id,
      );
    }),
};
