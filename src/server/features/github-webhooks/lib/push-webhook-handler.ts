import type { PushEvent } from "@octokit/webhooks-types";

import { prisma } from "@/server/shared/infrastructure/db";
import { logger } from "@/server/shared/infrastructure/logger";

export async function handlePushEvent(payload: PushEvent): Promise<void> {
  const { commits, ref, repository } = payload;

  const isDefaultBranch = ref === `refs/heads/${repository.default_branch}`;

  if (!isDefaultBranch) {
    return;
  }

  if (commits.length === 0) {
    return;
  }

  logger.info({
    branch: repository.default_branch,
    commitCount: commits.length,
    msg: "push_webhook_received_default_branch",
    repoName: repository.full_name,
  });

  try {
    const repo = await prisma.repo.findFirst({
      where: { githubId: repository.id },
    });

    if (!repo) return;

    // TODO: Здесь триггеришь задачу на анализ всего репозитория или
    // частичных изменений для векторной БД/документации
    // await generateDocsTask.trigger({
    //   repoId: repo.id,
    //   sha: payload.after // SHA последнего коммита в пуше
    // });
  } catch (error) {
    logger.error({ error, msg: "push_webhook_error" });
    throw error;
  }
}
