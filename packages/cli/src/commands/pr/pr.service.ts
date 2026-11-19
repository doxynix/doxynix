import {
  collectCursorPages,
  MAX_CURSOR_PAGES,
  MAX_PAGE_SIZE,
  summarizeCursorPages,
} from "@doxynix/shared";

import { trpc } from "@/core/client";

import type {
  ApplyFixInput,
  CreateFixInput,
  GetAnalysisInput,
  GetByPRNumberInput,
  OpenPullRequestInput,
  PostCommentInput,
  PRCommentsPage,
  PRListPage,
} from "./pr.types";

export const prService = {
  async applyFix(input: ApplyFixInput) {
    return trpc.analysis.applyFix.mutate(input);
  },

  async createFix(input: CreateFixInput) {
    return trpc.analysis.createFix.mutate(input);
  },

  async getAnalysis(input: GetAnalysisInput) {
    return trpc.analysis.getAnalysis.query(input);
  },

  async getByPRNumber(input: GetByPRNumberInput) {
    return trpc.analysis.getByPRNumber.query(input);
  },

  async getComments(analysisId: string) {
    const pages: PRCommentsPage[] = [];
    let cursor: string | undefined;

    // The table prints one list, so the walk keeps the old single-payload shape: a bounded number
    // of pages are folded back into `renderedComments`.
    for (let page = 0; page < MAX_CURSOR_PAGES; page += 1) {
      const result = await trpc.analysis.getComments.query({
        analysisId,
        cursor,
        limit: MAX_PAGE_SIZE,
      });
      pages.push(result);

      if (result.meta.nextCursor == null) {
        break;
      }

      cursor = result.meta.nextCursor;
    }

    return {
      meta: pages.at(-1)?.meta ?? { hasNextPage: false },
      renderedComments: pages.flatMap((page) => page.renderedComments),
      total: pages.find((page) => page.total != null)?.total ?? 0,
    };
  },

  async getFixById(fixId: string) {
    return trpc.analysis.getById.query({ fixId });
  },

  async listByRepository(repoId: string) {
    const pages: PRListPage[] = [];

    // Walks every page so `dxnx pr review <number>` resolves a PR older than the newest page;
    // `hasNextPage` survives only when the shared page bound truncates the walk.
    await collectCursorPages(async (cursor) => {
      const page = await trpc.analysis.listByRepository.query({
        cursor,
        limit: MAX_PAGE_SIZE,
        repoId,
      });
      pages.push(page);
      return page;
    });

    return summarizeCursorPages(pages);
  },

  async openPullRequest(input: OpenPullRequestInput) {
    return trpc.analysis.openPullRequest.mutate(input);
  },

  async postComment(input: PostCommentInput) {
    return trpc.analysis.postCommentToPR.mutate(input);
  },
};
