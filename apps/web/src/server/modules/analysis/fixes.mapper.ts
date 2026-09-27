import type { Prisma } from "@prisma/client";

import type { FixResult, GeneratedFixDetailedView, GeneratedFixView } from "./analysis.schemas";
import type { RepoNodeContextPayload } from "./logic/workspace.types";

export type GeneratedFixRecord = Prisma.GeneratedFixGetPayload<Record<string, never>>;

export type GeneratedFixSummaryRecord = Prisma.GeneratedFixGetPayload<{
  select: {
    githubPrNumber: true;
    githubPrUrl: true;
    id: true;
    status: true;
    title: true;
  };
}>;

export type GeneratedFixSummary = RepoNodeContextPayload["related"]["fixes"][number];

export const fixesMapper = {
  toDetailed(fix: GeneratedFixRecord, resultJson: FixResult | null): GeneratedFixDetailedView {
    return {
      branch: fix.branch,
      createdAt: fix.createdAt,
      description: fix.description,
      estimatedImpact: fix.estimatedImpact,
      githubPrNumber: fix.githubPrNumber,
      githubPrUrl: fix.githubPrUrl,
      id: fix.id,
      resultJson,
      status: fix.status,
      title: fix.title,
    };
  },

  toPublic(fix: GeneratedFixRecord): GeneratedFixView {
    return {
      branch: fix.branch,
      createdAt: fix.createdAt,
      description: fix.description,
      estimatedImpact: fix.estimatedImpact,
      githubPrNumber: fix.githubPrNumber,
      githubPrUrl: fix.githubPrUrl,
      id: fix.id,
      status: fix.status,
      title: fix.title,
    };
  },

  toSummary(fix: GeneratedFixSummaryRecord): GeneratedFixSummary {
    return {
      githubPrNumber: fix.githubPrNumber,
      githubPrUrl: fix.githubPrUrl,
      id: fix.id,
      status: fix.status,
      title: fix.title,
    };
  },
};
