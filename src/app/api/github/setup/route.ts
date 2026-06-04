import { redirect, unauthorized } from "next/navigation";
import type { NextRequest } from "next/server";

import { appLogger } from "@/server/core/app-logger";
import { getServerAuthSession } from "@/server/core/auth";
import { prisma } from "@/server/core/db";
import { githubAppService } from "@/server/core/github/github-app.service";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const installationId = searchParams.get("installation_id");
  const state = searchParams.get("state");

  const session = await getServerAuthSession();

  if (session?.user.id == null) {
    return unauthorized();
  }

  if (state == null) {
    if (installationId == null) {
      return redirect("/dashboard?error=setup_params_missing");
    }

    appLogger.info({
      installationId,
      msg: "GitHub App installed, redirecting to dashboard for background sync",
      userId: session.user.id,
    });

    return redirect("/dashboard?success=github_connected");
  }

  if (installationId == null) {
    return redirect("/dashboard?error=setup_params_missing");
  }

  try {
    await githubAppService.saveInstallation(prisma, Number(session.user.id), installationId, state);
  } catch (error) {
    appLogger.error({
      error: error instanceof Error ? error.message : String(error),
      msg: "GitHub Setup Error:",
    });
    return redirect("/dashboard?error=setup_failed");
  }

  return redirect("/dashboard?success=github_connected");
}
