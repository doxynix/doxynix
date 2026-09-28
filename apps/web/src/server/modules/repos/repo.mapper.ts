import { type PaginationMeta, type PublicRepo, Status } from "@doxynix/shared";
import type { Prisma } from "@prisma/client";

import { getLanguageColor } from "@/server/utils/language-metadata";

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

export type RepoRecord = Prisma.RepoGetPayload<Record<string, never>>;

export type SlimRepoRecord = Prisma.RepoGetPayload<{
  select: {
    id: true;
    name: true;
    owner: true;
    ownerAvatarUrl: true;
  };
}>;

export type SlimRepo = {
  avatar: null | string;
  id: string;
  name: string;
  owner: string;
};

type RepoMetrics = {
  complexityScore: null | number;
  healthScore: null | number;
  languageColor: string;
  lastAnalysisDate: Date | null;
  onboardingScore: null | number;
  securityScore: null | number;
  techDebtScore: null | number;
};

export const repoMapper = {
  latestStatus(analyses: Array<{ status: Status }>): Status {
    return analyses[0]?.status ?? Status.NEW;
  },

  toPaginatedList(items: RepoWithAnalyses[], meta: PaginationMeta) {
    return {
      items: items.map((item) => this.toPublic(item)),
      meta,
    };
  },

  toPublic(repo: RepoWithAnalyses): PublicRepo & RepoMetrics {
    return {
      ...this.toPublicFields(repo),
      complexityScore: repo.analyses[0]?.complexityScore ?? null,
      healthScore: repo.analyses[0]?.score ?? null,
      languageColor: getLanguageColor(repo.language),
      lastAnalysisDate: repo.analyses[0]?.createdAt ?? null,
      onboardingScore: repo.analyses[0]?.onboardingScore ?? null,
      securityScore: repo.analyses[0]?.securityScore ?? null,
      status: this.latestStatus(repo.analyses),
      techDebtScore: repo.analyses[0]?.techDebtScore ?? null,
    };
  },

  toPublicFields(repo: RepoRecord): Omit<PublicRepo, "status"> {
    return {
      createdAt: repo.createdAt,
      defaultBranch: repo.defaultBranch,
      description: repo.description,
      forks: repo.forks,
      githubCreatedAt: repo.githubCreatedAt,
      githubId: repo.githubId,
      id: repo.id,
      language: repo.language,
      license: repo.license,
      name: repo.name,
      openIssues: repo.openIssues,
      owner: repo.owner,
      ownerAvatarUrl: repo.ownerAvatarUrl,
      pushedAt: repo.pushedAt,
      size: repo.size,
      stars: repo.stars,
      topics: repo.topics,
      updatedAt: repo.updatedAt,
      url: repo.url,
      visibility: repo.visibility,
    };
  },

  toSlim(repo: SlimRepoRecord): SlimRepo {
    return {
      avatar: repo.ownerAvatarUrl,
      id: repo.id,
      name: repo.name,
      owner: repo.owner,
    };
  },
};
