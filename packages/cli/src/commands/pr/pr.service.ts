import { collectCursorPages, MAX_PAGE_SIZE, summarizeCursorPages } from "@doxynix/shared";

import { trpc } from "@/core/client";

import type {
  ApplyFixInput,
  CreateFixInput,
  GetAnalysisInput,
  GetByPRNumberInput,
  OpenPullRequestInput,
  PostCommentInput,
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
    return trpc.analysis.getComments.query({ analysisId });
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
