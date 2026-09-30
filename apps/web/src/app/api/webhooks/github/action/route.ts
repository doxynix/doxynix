import { NextResponse } from "next/server";
import * as z from "zod";

import { prisma } from "@/server/core/db";
import { analysisLifecycleService } from "@/server/modules/analysis/services/analysis-lifecycle.service";
import { AppError } from "@/server/utils/api-error";
import { verifyAndUseApiKey } from "@/server/utils/verify-and-use-api-key";
import { withApiHandler } from "@/server/utils/with-api-handler";

async function handler(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (authHeader == null || !authHeader.startsWith("Bearer ")) {
    throw new AppError({
      code: "UNAUTHORIZED",
      publicMessage: "Unauthorized",
    });
  }

  const apiKeyToken = authHeader.slice(7);

  const keyRecord = await verifyAndUseApiKey(apiKeyToken);

  if (keyRecord == null) {
    throw new AppError({ code: "UNAUTHORIZED", publicMessage: "Invalid API Key" });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new AppError({ code: "BAD_REQUEST", publicMessage: "Invalid JSON payload" });
  }

  const schema = z.object({
    branch: z.string().optional(),
    repository: z
      .string()
      .min(1)
      .refine((val) => val.split("/").length === 2, {
        message: "Repository must be in 'owner/name' format",
      }),
  });

  const parseResult = schema.safeParse(body);
  if (!parseResult.success) {
    throw new AppError({
      code: "BAD_REQUEST",
      publicMessage: parseResult.error.issues[0]?.message ?? "Invalid request body",
      zodIssues: parseResult.error.issues,
    });
  }

  const { branch, repository } = parseResult.data;
  const [owner, name] = repository.split("/");

  const dbRepo = await prisma.repo.findFirst({
    where: {
      name: { equals: name, mode: "insensitive" },
      owner: { equals: owner, mode: "insensitive" },
      userId: keyRecord.userId,
    },
  });

  if (dbRepo == null) {
    throw new AppError({ code: "NOT_FOUND", publicMessage: "Repository not registered" });
  }

  const analysisResponse = await analysisLifecycleService.analyze(prisma, keyRecord.userId, {
    branch: branch ?? dbRepo.defaultBranch,
    docTypes: ["README", "API", "ARCHITECTURE", "CONTRIBUTING", "CHANGELOG"],
    files: ["**/*"],
    language: "English",
    repoId: dbRepo.id,
  });

  return NextResponse.json({ jobId: analysisResponse.jobId });
}

/**
 * The previous `catch {}` here discarded its binding, so a failure anywhere in
 * the handler answered `500 {"error":"Internal Server Error"}` with nothing
 * logged anywhere — the one route in the app where a bug was invisible.
 */
export const POST = withApiHandler(handler, { scope: "webhooks/github/action" });
