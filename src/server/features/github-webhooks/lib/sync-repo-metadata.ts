import type { Repository } from "@octokit/webhooks-types";
import { Visibility } from "@prisma/client";

import { prisma } from "@/server/shared/infrastructure/db";
import { logger } from "@/server/shared/infrastructure/logger";

/**
 * Оппортунистическое обновление данных репозитория из любого GitHub payload.
 * Вызывается без `await` в основных хендлерах, чтобы не блокировать ответ гитхабу.
 */
export async function syncRepoMetadata(repository: Repository): Promise<void> {
  try {
    let repoVisibility = Visibility.PRIVATE as Visibility;
    if (repository.visibility === "public" || repository.private === false) {
      repoVisibility = Visibility.PUBLIC;
    } else if (repository.visibility === "internal") {
      repoVisibility = Visibility.PRIVATE;
    }

    const licenseName = repository.license
      ? repository.license.spdx_id !== "NOASSERTION"
        ? repository.license.spdx_id
        : repository.license.name
      : null;

    let pushedAtDate: Date | undefined = undefined;
    if (repository.pushed_at != null) {
      if (typeof repository.pushed_at === "number") {
        pushedAtDate = new Date(repository.pushed_at * 1000);
      } else {
        pushedAtDate = new Date(repository.pushed_at);
      }
    }

    const result = await prisma.repo.updateMany({
      data: {
        defaultBranch: repository.default_branch,
        description: repository.description?.slice(0, 1000) ?? null,
        forks: repository.forks_count,
        language: repository.language,
        license: licenseName,
        name: repository.name,
        openIssues: repository.open_issues_count,
        owner: repository.owner.login,
        ownerAvatarUrl: repository.owner.avatar_url,
        pushedAt: pushedAtDate,
        size: repository.size,
        stars: repository.stargazers_count,
        topics: repository.topics,
        url: repository.html_url,
        visibility: repoVisibility,
      },
      where: { githubId: repository.id },
    });

    if (result.count > 0) {
      logger.debug({
        affectedRows: result.count,
        githubId: repository.id,
        msg: "repo_metadata_opportunistically_synced",
        repoName: repository.full_name,
      });
    }
  } catch (error) {
    logger.error({
      error: error instanceof Error ? error.message : String(error),
      githubId: repository.id,
      msg: "failed_to_sync_repo_metadata",
    });
  }
}
