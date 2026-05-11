import type { RepositoryEvent } from "@octokit/webhooks-types";

import { appLogger } from "@/server/core/app-logger";
import { prisma } from "@/server/core/db";

import { syncRepoMetadata } from "./sync-repo-metadata";

export async function handleRepositoryEvent(payload: RepositoryEvent): Promise<void> {
  const { action, repository } = payload;

  appLogger.info({
    action,
    githubId: repository.id,
    msg: "repository_webhook_received",
    repoName: repository.full_name,
  });

  try {
    if (action === "deleted") {
      const result = await prisma.repo.deleteMany({
        where: { githubId: repository.id },
      });

      appLogger.info({
        affectedRows: result.count,
        githubId: repository.id,
        msg: "repository_deleted_in_db",
      });
      return;
    }

    if (action === "archived") {
      appLogger.info({ githubId: repository.id, msg: "repository_archived" });
    }

    const syncActions = [
      "renamed",
      "edited",
      "privatized",
      "publicized",
      "archived",
      "transferred",
      "unarchived",
    ];
    if (syncActions.includes(action)) {
      await syncRepoMetadata(repository);

      appLogger.info({
        action,
        githubId: repository.id,
        msg: "repository_state_updated",
      });
    }
  } catch (error) {
    appLogger.error({ error, msg: "repository_webhook_error" });
    throw error;
  }
}
