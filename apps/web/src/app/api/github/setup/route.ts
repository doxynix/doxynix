import { headers } from "next/headers";
import { redirect, unauthorized } from "next/navigation";
import type { NextRequest } from "next/server";

import { appLogger } from "@/server/core/app-logger";
import { auth } from "@/server/core/auth";
import { prisma } from "@/server/core/db";
import { githubAppService } from "@/server/modules/repos/github-app.service";
import {
  type GithubSetupOutcome,
  resolveGithubSetupRedirect,
} from "@/server/modules/repos/github-setup-redirect";
import { withApiHandler } from "@/server/utils/with-api-handler";

async function handler(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const installationId = searchParams.get("installation_id");
  const state = searchParams.get("state");

  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (session?.user.id == null) {
    return unauthorized();
  }

  const userId = session.user.id;
  const user = await prisma.user.findUnique({
    select: { onboardingCompletedAt: true },
    where: { id: userId },
  });

  const onboardingCompleted = user?.onboardingCompletedAt != null;

  const finish = (outcome: GithubSetupOutcome) => {
    return redirect(resolveGithubSetupRedirect(outcome, onboardingCompleted));
  };

  if (state == null) {
    // A bare GitHub install has no workspace to claim into. Do not report success: the user has
    // to start the install from a workspace so the state binds the installation to an owner.
    appLogger.warn({
      installationId,
      msg: "GitHub App installed without a workspace state; installation stays unclaimed",
      userId,
    });

    return finish("missing_params");
  }

  if (installationId == null) {
    return finish("missing_params");
  }

  try {
    await githubAppService.saveInstallation(prisma, userId, installationId, state);
  } catch (error) {
    appLogger.error({
      error: error instanceof Error ? error.message : String(error),
      msg: "GitHub Setup Error:",
    });
    return finish("error");
  }

  return finish("success");
}

// redirect()/unauthorized() throw; withApiHandler recognizes Next's control-flow digests and re-throws them, so the local catch only covers saveInstallation failures.
export const GET = withApiHandler(handler, { scope: "github/setup" });
