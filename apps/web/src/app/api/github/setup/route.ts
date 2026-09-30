import { headers } from "next/headers";
import { redirect, unauthorized } from "next/navigation";
import type { NextRequest } from "next/server";

import { appLogger } from "@/server/core/app-logger";
import { auth } from "@/server/core/auth";
import { prisma } from "@/server/core/db";
import { githubAppService } from "@/server/core/github/github-app.service";
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

  if (state == null) {
    if (installationId == null) {
      return redirect("/dashboard?error=setup_params_missing");
    }

    appLogger.info({
      installationId,
      msg: "GitHub App installed, redirecting to dashboard for background sync",
      userId,
    });

    return redirect("/dashboard?success=github_connected");
  }

  if (installationId == null) {
    return redirect("/dashboard?error=setup_params_missing");
  }

  try {
    await githubAppService.saveInstallation(prisma, userId, installationId, state);
  } catch (error) {
    appLogger.error({
      error: error instanceof Error ? error.message : String(error),
      msg: "GitHub Setup Error:",
    });
    return redirect("/dashboard?error=setup_failed");
  }

  return redirect("/dashboard?success=github_connected");
}

/**
 * `redirect()` and `unauthorized()` throw rather than return; `withApiHandler`
 * recognizes Next's control-flow digests and re-throws them untouched, so
 * wrapping this route keeps the redirects working. Failures inside
 * `saveInstallation` are still caught locally, because the browser must land on
 * the dashboard with `?error=setup_failed` rather than see a JSON 500.
 */
export const GET = withApiHandler(handler, { scope: "github/setup" });
