import { zodSchema } from "ai";
import { z } from "zod";

import { prisma } from "@/server/shared/infrastructure/db";
import { githubBrowseService } from "@/server/shared/infrastructure/github/github-browse.service";
import { logger } from "@/server/shared/infrastructure/logger";
import { CodeOptimizer } from "@/server/shared/lib/optimizers";

export function buildRepositoryTools(userId: number, repoId: string, branch: string) {
  const tools: Record<string, any> = {
    listFiles: {
      description: "Get the directory tree of the repository to discover files.",
      execute: async ({ prefix }: { prefix?: string }) => {
        try {
          logger.info({ msg: "AI Tool: listFiles", prefix, repoId });
          const repo = await prisma.repo.findUnique({ where: { publicId: repoId } });
          if (!repo) return "Error: Repo not found";

          const tree = await githubBrowseService.getRepoFiles(
            prisma,
            userId,
            repo.owner,
            repo.name,
            branch
          );

          let paths = tree.map((t) => t[0] as string);
          if (prefix != null) paths = paths.filter((p) => p.startsWith(prefix));

          return paths.slice(0, 500).join("\n");
        } catch {
          return "Error listing files.";
        }
      },
      parameters: zodSchema(
        z.object({
          prefix: z.string().optional().describe("Optional folder path to filter by"),
        })
      ),
    },

    readFile: {
      description:
        "Read the full content of a specific file from the repository. Use this ONLY when you need implementation details that are missing from the snippets.",
      execute: async ({ path }: { path: string }) => {
        try {
          logger.info({ msg: "AI Tool: readFile", path, repoId, userId });
          const fileData = await githubBrowseService.getFileContent(
            prisma,
            prisma,
            userId,
            repoId,
            path,
            branch
          );
          const cleanedContent = await CodeOptimizer.cleanForTool(fileData.content);

          return {
            content: cleanedContent.slice(0, 50_000),
            path: path,
          };
        } catch (error) {
          logger.warn({ error, msg: "AI Tool Failed: readFile", path });
          return `Error: Could not read file ${path}. Proceed with available info.`;
        }
      },
      parameters: zodSchema(
        z.object({
          path: z.string().describe("The full path to the file (e.g., 'src/server/api.ts')"),
        })
      ),
    },
  };

  return tools;
}
