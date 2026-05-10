import { Status, type Prisma } from "@prisma/client";

import { getLanguageColor } from "@/server/utils/language-metadata";
import type { PaginationMeta } from "@/server/utils/pagination";

export type RepoWithAnalyses = Prisma.RepoGetPayload<{
  include: {
    analyses: {
      select: {
        complexityScore: true;
        createdAt: true;
        onboardingScore: true;
        score: true;
        securityScore: true;
        status: true;
        techDebtScore: true;
      };
    };
  };
}>;

export const repoMapper = {
  toPaginatedList(items: RepoWithAnalyses[], meta: PaginationMeta) {
    return {
      items: items.map((item) => this.toPublic(item)),
      meta,
    };
  },

  toPublic(repo: RepoWithAnalyses) {
    return {
      ...repo,
      complexityScore: repo.analyses[0]?.complexityScore ?? null,
      healthScore: repo.analyses[0]?.score ?? null,
      id: repo.publicId,
      languageColor: getLanguageColor(repo.language),
      lastAnalysisDate: repo.analyses[0]?.createdAt ?? null,
      onboardingScore: repo.analyses[0]?.onboardingScore ?? null,
      securityScore: repo.analyses[0]?.securityScore ?? null,
      status: repo.analyses[0]?.status ?? Status.NEW,
      techDebtScore: repo.analyses[0]?.techDebtScore ?? null,
    };
  },
};
