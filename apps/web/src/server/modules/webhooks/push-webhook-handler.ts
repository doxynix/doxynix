import { appLogger } from "@/server/core/app-logger";
import { prisma } from "@/server/core/db";
import { getWorkspaceEntitlement, hasPlanFeature } from "@/server/core/entitlements";
import type { PushPayload } from "@/server/core/github/github-webhook.types";

export async function handlePushEvent(payload: PushPayload): Promise<void> {
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

  // A GitHub repository can be connected by several workspaces, so the resync decision is made per
  // workspace instead of picking one (the class of bug this handler already had once, C11).
  const repos = await prisma.repo.findMany({
    select: { workspaceId: true },
    where: { githubId: repository.id },
  });

  for (const repo of repos) {
    const entitlement = await getWorkspaceEntitlement(prisma, repo.workspaceId);

    if (!hasPlanFeature(entitlement, "autoResync")) {
      appLogger.info({
        msg: "push_autoresync_disabled",
        planCode: entitlement?.planCode,
        repoName: repository.full_name,
        workspaceId: repo.workspaceId,
      });
    }
  }

  // TODO(dxnx): trigger the analysis task for the entire repository here, or for partial
  // changes for the vector DB/docs. The `autoResync` gate above already decides which workspaces
  // are allowed to receive that run.
}
