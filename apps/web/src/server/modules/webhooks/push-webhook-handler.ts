import type { PushEvent } from "@octokit/webhooks-types";

import { appLogger } from "@/server/core/app-logger";
import { prisma } from "@/server/core/db";

export async function handlePushEvent(payload: PushEvent): Promise<void> {
  const { commits, ref, repository } = payload;

  const isDefaultBranch = ref === `refs/heads/${repository.default_branch}`;

  if (!isDefaultBranch) {
    return;
  }

  if (commits.length === 0) {
    return;
  }

  appLogger.info({
    branch: repository.default_branch,
    commitCount: commits.length,
    msg: "push_webhook_received_default_branch",
    repoName: repository.full_name,
  });

  try {
    const repo = await prisma.repo.findFirst({
      where: { githubId: repository.id },
    });

    if (repo == null) {
      return undefined;
    }

    // TODO: Trigger the analysis task for the entire repository here, or
    // for partial changes for the vector DB/docs
    // await generateDocsTask.trigger({
    //   repoId: repo.id,
    //   sha: payload.after // SHA of the last commit in the push
    // });
  } catch (error) {
    appLogger.error({ error, msg: "push_webhook_error" });
    throw error;
  }
}
