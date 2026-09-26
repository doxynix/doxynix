import { DocTypeSchema } from "@doxynix/shared";
import * as z from "zod";

import { protectedProcedure } from "@/server/core/trpc/init";

import { docsService, GetWithGraphLinksInput } from "./services/docs.service";
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
  documentFile: protectedProcedure.input(FileActionInputSchema).mutation(async ({ ctx, input }) => {
    return fileActionsService.documentFile(ctx.db, Number(ctx.session.user.id), input);
  }),
  getAvailableDocs: protectedProcedure
    .input(z.object({ aid: z.string().optional(), repoId: z.uuid() }))
    .query(async ({ ctx, input }) => {
      return docsService.getAvailableDocs(ctx.db, input.repoId, input.aid);
    }),
  getDocumentContent: protectedProcedure
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
  getWithGraphLinks: protectedProcedure
    .input(GetWithGraphLinksInput)
    .query(async ({ ctx, input }) => {
      return docsService.getWithGraphLinks(ctx.db, input);
    }),
  highlightFile: protectedProcedure
    .input(z.object({ content: z.string(), path: z.string() }))
    .query(async ({ input }) => {
      return docsService.highlightFile(input.content, input.path);
    }),
  pinAuditToDocs: protectedProcedure
    .input(
      z.object({
        path: z.string(),
        repoId: z.uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return docsService.pinAuditToDocs(ctx.db, ctx.redis, ctx.session.user.id, input);
    }),
  quickFileAudit: protectedProcedure
    .input(FileActionInputSchema)
    .mutation(async ({ ctx, input }) => {
      return fileActionsService.quickFileAudit(ctx.db, Number(ctx.session.user.id), input);
    }),
};
