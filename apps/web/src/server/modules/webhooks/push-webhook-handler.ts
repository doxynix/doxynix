import { appLogger } from "@/server/core/app-logger";
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

  // The repo lookup that used to sit here cost one query per push webhook and changed nothing:
  // its result was read only for a `length === 0` early return, and the code after it is still a
  // TODO. Wiring the analysis task means re-adding it — and fanning out over every connected
  // account, not picking one, which is the class of bug this handler already had once (C11).
  //
  // TODO(dxnx): trigger the analysis task for the entire repository here, or for partial
  // changes for the vector DB/docs.
}
