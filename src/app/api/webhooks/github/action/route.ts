import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/server/core/db";
import { repoAnalysisService } from "@/server/modules/analysis/analysis.service";
import { verifyAndUseApiKey } from "@/server/utils/verify-and-use-api-key";

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("Authorization");
    if (authHeader == null || !authHeader.startsWith("Bearer ")) {
      return new NextResponse(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    const apiKeyToken = authHeader.slice(7);

    const keyRecord = await verifyAndUseApiKey(apiKeyToken);

    if (keyRecord == null) {
      return new NextResponse(JSON.stringify({ error: "Invalid API Key" }), { status: 401 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
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
      return NextResponse.json(
        { error: parseResult.error.issues[0]?.message ?? "Invalid request body" },
        { status: 400 }
      );
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
      return new NextResponse(JSON.stringify({ error: "Repository not registered" }), {
        status: 404,
      });
    }

    const analysisResponse = await repoAnalysisService.analyze(prisma, keyRecord.userId, {
      branch: branch ?? dbRepo.defaultBranch,
      docTypes: ["README", "API", "ARCHITECTURE", "CONTRIBUTING", "CHANGELOG"],
      files: ["**/*"],
      language: "English",
      repoId: dbRepo.publicId,
    });

    return NextResponse.json({ jobId: analysisResponse.jobId });
  } catch {
    return new NextResponse(JSON.stringify({ error: "Internal Server Error" }), { status: 500 });
  }
}
