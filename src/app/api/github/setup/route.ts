import { redirect, unauthorized } from "next/navigation";
import type { NextRequest } from "next/server";

import { getServerAuthSession } from "@/server/shared/infrastructure/auth";
import { prisma } from "@/server/shared/infrastructure/db";
import { githubAppService } from "@/server/shared/infrastructure/github/github-app.service";
import { logger } from "@/server/shared/infrastructure/logger";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const installationId = searchParams.get("installation_id");
  const state = searchParams.get("state");

  const session = await getServerAuthSession();

  if (session?.user.id == null) {
    return unauthorized();
  }

  if (installationId == null || state == null) {
    return redirect("/dashboard?error=setup_params_missing");
  }

  try {
    await githubAppService.saveInstallation(prisma, Number(session.user.id), installationId, state);
  } catch (error) {
    logger.error({ error, msg: "GitHub Setup Error:" });
    return redirect("/dashboard?error=setup_failed");
  }

  return redirect("/dashboard?success=github_connected");
}
