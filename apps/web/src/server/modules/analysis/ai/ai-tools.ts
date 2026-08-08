import { tool, type ToolSet } from "ai";
import { z } from "zod";

import { appLogger } from "@/server/core/app-logger";
import { prisma } from "@/server/core/db";
import { githubBrowseService } from "@/server/core/github/github-browse.service";
import { apiForUser } from "@/server/core/trpc/server";
import { CodeOptimizer } from "@/server/utils/optimizers";

export type RepositoryToolProfile =
  | "architect"
  | "file_action"
  | "fixer"
  | "github_agent"
  | "mapper"
  | "pr_review"
  | "writer_api"
  | "writer_architecture"
  | "writer_contributing"
  | "writer_readme";

const TOOL_KEYS_BY_PROFILE: Record<RepositoryToolProfile, readonly string[]> = {
  architect: ["readFile", "readMultipleFiles", "searchCode"],
  file_action: ["readFile", "readMultipleFiles", "searchCode"],
  fixer: ["readFile", "readMultipleFiles"],
  github_agent: [
    "listFiles",
    "readFile",
    "readMultipleFiles",
    "searchCode",
    "readPreviousDocument",
    "getLatestAnalysis",
    "triggerRepositoryAnalysis",
  ],
  mapper: ["listFiles", "readFile", "searchCode"],
  pr_review: ["readFile", "readMultipleFiles", "searchCode"],
  writer_api: ["readFile", "readMultipleFiles", "searchCode"],
  writer_architecture: ["readFile", "readMultipleFiles", "searchCode", "readPreviousDocument"],
  writer_contributing: ["readFile", "searchCode", "readPreviousDocument"],
  writer_readme: ["readFile", "readPreviousDocument"],
};

function buildRepositoryTools(userId: number, repoId: string, branch: string) {
  return {
    getBranches: tool({
      description: "Get all available git branches for this repository.",
      execute: async () => {
        try {
          appLogger.info({ msg: "AI Tool: getBranches", repoId });
          const repo = await prisma.repo.findUnique({ where: { publicId: repoId } });
          if (repo == null) return "Error: Repository not found.";

          return await githubBrowseService.getBranches(prisma, userId, repo.owner, repo.name);
        } catch (error) {
          appLogger.error({ error, msg: "AI Tool Failed: getBranches" });
          return "Error fetching repository branches.";
        }
      },
      inputSchema: z.object({}),
    }),

    // TODO: вынести в общий
    getLatestAnalysis: tool({
      description:
        "Check the status (PENDING, COMPLETED, FAILED) and metadata of the latest static code analysis run for a repository.",
      execute: async ({ repoId: inputRepoId }) => {
        const trpc = await apiForUser(userId);
        const targetRepoId = inputRepoId ?? repoId;

        return trpc.analysis.getLatest({ repoId: targetRepoId });
      },
      inputSchema: z.object({
        repoId: z
          .uuid()
          .describe("The public UUID of the repository to check the analysis status for")
          .optional(),
      }),
    }),

    listFiles: tool({
      description:
        "Get the directory tree of the repository to discover files. Returns list of file paths.",
      execute: async ({ prefix }) => {
        try {
          appLogger.info({ msg: "AI Tool: listFiles", prefix, repoId });
          const repo = await prisma.repo.findUnique({ where: { publicId: repoId } });
          if (repo == null) return "Error: Repo not found";

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
        } catch (error) {
          appLogger.error({ error, msg: "AI Tool Failed: listFiles" });
          return "Error listing files.";
        }
      },
      inputSchema: z.object({
        prefix: z.string().optional().describe("Optional folder path to filter by"),
      }),
    }),
    readFile: tool({
      description:
        "Read the content of a specific file from the repository. By default, it optimizes the file (hides implementations, keeping signatures and exports) to save context tokens. Set 'skeletonize' to false ONLY if you absolutely need the full raw implementation details.",
      execute: async ({ path, skeletonize }) => {
        try {
          const shouldSkeletonize = skeletonize ?? true;
          appLogger.info({
            msg: "AI Tool: readFile",
            path,
            repoId,
            skeletonize: shouldSkeletonize,
            userId,
          });

          const fileData = await githubBrowseService.getFileContent(
            prisma,
            prisma,
            userId,
            repoId,
            path,
            branch
          );

          const processedContent = shouldSkeletonize
            ? await CodeOptimizer.optimize(fileData.content, path)
            : await CodeOptimizer.cleanForTool(fileData.content);

          return {
            content: processedContent.slice(0, 50_000),
            path: path,
            skeletonized: shouldSkeletonize,
          };
        } catch (error) {
          appLogger.warn({ error, msg: "AI Tool Failed: readFile", path });
          return `Error: Could not read file ${path}. Proceed with available info.`;
        }
      },
      inputSchema: z.object({
        path: z.string().describe("The full path to the file (e.g., 'src/server/api.ts')"),
        skeletonize: z
          .boolean()
          .optional()
          .describe(
            "Whether to hide implementation details and keep signatures only. Defaults to true."
          ),
      }),
    }),
    readMultipleFiles: tool({
      description:
        "Read the content of multiple files from the repository at once. By default, it optimizes the files (hides implementations, keeping signatures and exports) to save context tokens. Set 'skeletonize' to false ONLY if you absolutely need the full raw implementation details.",
      execute: async ({ paths, skeletonize }) => {
        try {
          const shouldSkeletonize = skeletonize ?? true;
          appLogger.info({
            msg: "AI Tool: readMultipleFiles",
            paths,
            repoId,
            skeletonize: shouldSkeletonize,
            userId,
          });

          return await Promise.all(
            paths.slice(0, 10).map(async (path) => {
              try {
                const fileData = await githubBrowseService.getFileContent(
                  prisma,
                  prisma,
                  userId,
                  repoId,
                  path,
                  branch
                );

                const processedContent = shouldSkeletonize
                  ? await CodeOptimizer.optimize(fileData.content, path)
                  : await CodeOptimizer.cleanForTool(fileData.content);

                return {
                  content: processedContent.slice(0, 15_000),
                  path,
                  skeletonized: shouldSkeletonize,
                  success: true,
                };
              } catch {
                return {
                  content: `Error: Could not read ${path}`,
                  path,
                  success: false,
                };
              }
            })
          );
        } catch (error) {
          appLogger.error({ error, msg: "AI Tool Failed: readMultipleFiles" });
          return "Error reading multiple files.";
        }
      },
      inputSchema: z.object({
        paths: z.array(z.string()).min(1).max(10).describe("List of file paths to read"),
        skeletonize: z
          .boolean()
          .optional()
          .describe(
            "Whether to hide implementation details and keep signatures only. Defaults to true."
          ),
      }),
    }),

    readPreviousDocument: tool({
      description:
        "Retrieve previously generated or pinned documentation of various types (README, API, ARCHITECTURE, CONTRIBUTING, CHANGELOG) from the database for this repository. Use this to maintain context, compare older documents, or perform incremental updates.",
      execute: async ({ docType }) => {
        try {
          appLogger.info({ docType, msg: "AI Tool: readPreviousDocument", repoId });

          const repo = await prisma.repo.findUnique({ where: { publicId: repoId } });
          if (repo == null) return "Error: Repository not found.";

          const doc = await prisma.document.findFirst({
            orderBy: { createdAt: "desc" },
            where: {
              repoId: repo.id,
              type: docType,
            },
          });

          if (doc == null) {
            return `No previous documentation of type "${docType}" exists yet for this repository. This is the first analysis.`;
          }

          return {
            content: doc.content,
            type: doc.type,
            version: doc.version,
          };
        } catch (error) {
          appLogger.error({ error, msg: "AI Tool Failed: readPreviousDocument" });
          return "Error reading previous document from database.";
        }
      },
      inputSchema: z.object({
        docType: z
          .enum(["README", "API", "ARCHITECTURE", "CONTRIBUTING", "CHANGELOG", "CODE_DOC"])
          .describe("The type of previous document to retrieve"),
      }),
    }),

    searchCode: tool({
      description:
        "Perform a high-density, multi-term search across the repository indexed files. Use this to quickly find specific code patterns, function calls, variable definitions, or API usages across the codebase.",
      execute: async ({ search }) => {
        try {
          appLogger.info({ msg: "AI Tool: searchCode", repoId, search, userId });
          const trpc = await apiForUser(userId);
          const results = await trpc.analysis.searchWorkspace({
            repoId,
            search,
          });

          if (results.length === 0) {
            return `No relevant code snippets or files found for search term "${search}". Try a different query.`;
          }

          return results
            .map((item) => {
              const pathInfo = item.path != null ? `[[${item.path}]]` : "";
              const docInfo =
                item.docSectionId != null
                  ? ` (Section: ${item.docSectionId} in ${item.docType})`
                  : "";
              return `- ${item.label}: ${item.description}${pathInfo}${docInfo} (Score: ${item.score})`;
            })
            .join("\n")
            .slice(0, 1000);
        } catch (error) {
          appLogger.error({ error, msg: "AI Tool Failed: searchCode", repoId, search, userId });
          return `Error: Could not perform code search for "${search}".`;
        }
      },
      inputSchema: z.object({
        search: z
          .string()
          .min(2)
          .describe(
            "The term or keyword to search for (e.g., 'authMiddleware', 'createUser', 'Prisma.findUnique')"
          ),
      }),
    }),

    // TODO: вынести в общий
    triggerRepositoryAnalysis: tool({
      description: "Queue and start a complete static code analysis run for a repository.",
      execute: async ({ branch, repoId: inputRepoId }) => {
        const trpc = await apiForUser(userId);
        const targetRepoId = inputRepoId ?? repoId;

        return trpc.analysis.analyze({
          branch,
          docTypes: ["README", "API", "ARCHITECTURE", "CONTRIBUTING", "CHANGELOG"],
          files: ["**/*"],
          language: "English",
          repoId: targetRepoId,
        });
      },
      inputSchema: z.object({
        branch: z
          .string()
          .optional()
          .describe("Specific branch to target (defaults to default branch)"),
        repoId: z.uuid().describe("The public UUID of the repository to analyze").optional(),
      }),
    }),
  };
}

export function buildRepositoryToolProfile(
  profile: RepositoryToolProfile,
  userId: number,
  repoId: string,
  branch: string
): ToolSet {
  const allTools: ToolSet = buildRepositoryTools(userId, repoId, branch);
  const selectedTools: ToolSet = {};

  for (const key of TOOL_KEYS_BY_PROFILE[profile]) {
    const selected = allTools[key];
    if (selected != null) selectedTools[key] = selected;
  }

  return selectedTools;
}
