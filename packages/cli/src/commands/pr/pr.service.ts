import { trpc } from "@/core/client";

import {
  type ApplyFixInput,
  type CreateFixInput,
  type GetAnalysisInput,
  type GetByPRNumberInput,
  type GetImpactByPRNumberInput,
  type OpenPullRequestInput,
  type PostCommentInput,
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

  async getFixes(repoId: string) {
    return trpc.analysis.getByRepository.query({ repoId });
  },

  async getImpactByPRNumber(input: GetImpactByPRNumberInput) {
    return trpc.analysis.getImpactByPRNumber.query(input);
  },

  async listByRepository(repoId: string) {
    return trpc.analysis.listByRepository.query({ repoId });
  },

  async openPullRequest(input: OpenPullRequestInput) {
    return trpc.analysis.openPullRequest.mutate(input);
  },

  async postComment(input: PostCommentInput) {
    return trpc.analysis.postCommentToPR.mutate(input);
  },
};
