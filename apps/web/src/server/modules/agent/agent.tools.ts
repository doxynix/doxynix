import { tool } from "ai";
import { z } from "zod";

import { api } from "@/server/core/trpc/server";

export const getAgentTools = (currentRepoId?: string) => ({
  applyFix: tool({
    description: "Apply a generated code correction (creates a Pull Request on GitHub).",
    execute: async ({ branch, fixedFiles, fixId, repoId, title }) => {
      const trpc = await api();
      const targetRepoId = repoId ?? currentRepoId;
      if (targetRepoId == null) throw new Error("Missing repository context.");

      return trpc.analysis.applyFix({
        branch,
        fixedFiles,
        fixId,
        repoId: targetRepoId,
        title,
      });
    },
    inputSchema: z.object({
      branch: z.string().describe("The branch to create"),
      fixedFiles: z
        .array(
          z.object({
            filePath: z.string(),
            newContent: z.string(),
          })
        )
        .describe("The complete fixed file contents"),
      fixId: z.uuid().describe("The public UUID of the fix"),
      repoId: z.uuid().optional().describe("Optional custom repository UUID"),
      title: z.string().describe("The title of the Pull Request"),
    }),
    needsApproval: true,
  }),

  clearReadNotifications: tool({
    description: "Permanently delete all notifications that have already been marked as read.",
    execute: async () => {
      const trpc = await api();
      return trpc.notification.deleteRead({});
    },
    inputSchema: z.object({}),
  }),

  clearStaging: tool({
    description: "Clear and reset the active staging area, deleting all temporary staged files.",
    execute: async ({ repoId }) => {
      const trpc = await api();
      const targetRepoId = repoId ?? currentRepoId;
      if (targetRepoId == null) throw new Error("Missing repository context.");

      return trpc.analysis.clearStaging({ repoId: targetRepoId });
    },
    inputSchema: z.object({
      repoId: z.uuid().describe("The public UUID of the repository").optional(),
    }),
  }),

  createApiKey: tool({
    description: "Generate a new secure API key for the user's account.",
    execute: async ({ description, name }) => {
      const trpc = await api();
      return trpc.apikey.create({ description, name });
    },
    inputSchema: z.object({
      description: z.string().optional().describe("Optional description of the key's purpose"),
      name: z.string().min(1).describe("Friendly name for the key (e.g., 'CI-CD-key')"),
    }),
  }),

  createFix: tool({
    description:
      "Generate automated code corrections (refactoring, security fixes) for detected findings.",
    execute: async ({ fileContents, findings, prAnalysisId, repoId }) => {
      const trpc = await api();
      const targetRepoId = repoId ?? currentRepoId;
      if (targetRepoId == null) throw new Error("Missing repository context.");

      return trpc.analysis.createFix({
        fileContents,
        findings,
        prAnalysisId,
        repoId: targetRepoId,
      });
    },
    inputSchema: z.object({
      fileContents: z
        .record(z.string(), z.string())
        .describe("Map of file path to original content"),
      findings: z.array(z.any()).min(1).describe("The findings list to fix"),
      prAnalysisId: z.uuid().optional(),
      repoId: z.uuid().describe("The public UUID of the repository").optional(),
    }),
  }),

  deleteRepository: tool({
    description:
      "Permanently delete a repository from Doxynix along with all its audits and history. This does not affect the original GitHub repository.",
    execute: async ({ repoId }) => {
      const trpc = await api();
      return trpc.repo.delete({ id: repoId });
    },
    inputSchema: z.object({
      repoId: z.uuid().describe("The unique public UUID of the repository to delete"),
    }),
    needsApproval: true,
  }),

  documentFile: tool({
    description:
      "Generate inline structured documentation comments (JSDoc, KotlinDoc) for a single file.",
    execute: async ({ branch, content, language, path, repoId }) => {
      const trpc = await api();
      const targetRepoId = repoId ?? currentRepoId;
      if (targetRepoId == null) throw new Error("Missing repository context.");

      return trpc.analysis.documentFile({
        branch,
        content,
        language,
        path,
        repoId: targetRepoId,
      });
    },
    inputSchema: z.object({
      branch: z.string().describe("Selected branch"),
      content: z.string().describe("The actual raw content of the file"),
      language: z.string().default("English"),
      path: z.string().describe("The file path to document"),
      repoId: z.uuid().describe("The public UUID of the repository").optional(),
    }),
  }),

  getAnalysisComments: tool({
    description:
      "Retrieve specific code analysis findings, vulnerabilities, warnings, and lines of code where bugs were found for a given analysis run.",
    execute: async ({ analysisId }) => {
      const trpc = await api();
      return trpc.analysis.getComments({ analysisId });
    },
    inputSchema: z.object({
      analysisId: z
        .string()
        .describe("The unique UUID of the analysis run to retrieve findings/vulnerabilities for"),
    }),
  }),

  getBranches: tool({
    description: "Get all available branches for a repository.",
    execute: async ({ name, owner }) => {
      const trpc = await api();
      return trpc.githubBrowse.getBranches({ name, owner });
    },
    inputSchema: z.object({
      name: z.string(),
      owner: z.string(),
    }),
  }),

  getFileActionResult: tool({
    description:
      "Retrieve the completed results of a rapid file audit (quick-file-audit) or file documentation task (document-file-preview) from Redis cache using the file path.",
    execute: async ({ action, path }) => {
      const trpc = await api();
      return trpc.analysis.getFileActionResult({ action, path });
    },
    inputSchema: z.object({
      action: z
        .enum(["document-file-preview", "quick-file-audit"])
        .describe("The file action type to retrieve"),
      path: z
        .string()
        .describe(
          "The exact relative path of the file that was audited (e.g. 'routes/auth/login/loginRoute.js')"
        ),
    }),
  }),

  getFileContent: tool({
    description:
      "Read the actual raw content of any file directly from GitHub. Use this when you need to inspect code that wasn't provided in the prompt.",
    execute: async ({ branch, path, repoId }) => {
      const trpc = await api();
      const targetRepoId = repoId ?? currentRepoId;
      if (targetRepoId == null) throw new Error("Missing repository context.");

      return trpc.githubBrowse.getFileContent({ branch, path, repoId: targetRepoId });
    },
    inputSchema: z.object({
      branch: z.string().optional(),
      path: z.string().describe("The file path to read (e.g. 'src/index.ts')"),
      repoId: z.uuid().describe("The public UUID of the repository").optional(),
    }),
  }),

  getGeneratedFixDetails: tool({
    description:
      "Retrieve the detailed metadata and generated file corrections (including raw diffs/content stored in Redis) for a specific AI-generated fix by its ID.",
    execute: async ({ fixId }) => {
      const trpc = await api();
      return trpc.analysis.getById({ fixId });
    },
    inputSchema: z.object({
      fixId: z
        .uuid()
        .describe("The unique public UUID of the generated fix to retrieve details for"),
    }),
  }),
  // TODO: вынести в общий

  getLatestAnalysis: tool({
    description:
      "Check the status (PENDING, COMPLETED, FAILED) and metadata of the latest static code analysis run for a repository.",
    execute: async ({ repoId }) => {
      const trpc = await api();
      const targetRepoId = repoId ?? currentRepoId;
      if (targetRepoId == null) throw new Error("Missing repository context.");

      return trpc.analysis.getLatest({ repoId: targetRepoId });
    },
    inputSchema: z.object({
      repoId: z
        .uuid()
        .describe("The public UUID of the repository to check the analysis status for")
        .optional(),
    }),
  }),

  getNotificationStats: tool({
    description: "Get notifications statistics (total, read, unread counts) for the user.",
    execute: async () => {
      const trpc = await api();
      return trpc.notification.getStats();
    },
    inputSchema: z.object({}),
  }),

  getRepoAnalytics: tool({
    description:
      "Retrieve aggregated quality metrics, global scores (security, health, complexity, onboarding), and language distribution for a repository.",
    execute: async ({ repoId }) => {
      const trpc = await api();
      const targetRepoId = repoId ?? currentRepoId;
      if (targetRepoId == null) throw new Error("No active repository context.");

      return trpc.analytics.getDashboardStats({ repoId: targetRepoId });
    },
    inputSchema: z.object({
      repoId: z.uuid().describe("The public UUID of the repository").optional(),
    }),
  }),

  getRepoFiles: tool({
    description:
      "List the file tree structure of the repository. Use this to orient yourself and find paths in the repository.",
    execute: async ({ branch, name, owner }) => {
      const trpc = await api();
      return trpc.githubBrowse.getRepoFiles({ branch, name, owner });
    },
    inputSchema: z.object({
      branch: z.string().optional().describe("The branch to read (defaults to default branch)"),
      name: z.string().describe("The name of the repository"),
      owner: z.string().describe("The GitHub owner/organization"),
    }),
  }),

  getStagedFiles: tool({
    description: "List all files currently held in the staging area for an upcoming Pull Request.",
    execute: async ({ repoId }) => {
      const trpc = await api();
      const targetRepoId = repoId ?? currentRepoId;
      if (targetRepoId == null) throw new Error("Missing repository context.");

      return trpc.analysis.getStagedFiles({ repoId: targetRepoId });
    },
    inputSchema: z.object({
      repoId: z.uuid().describe("The public UUID of the repository").optional(),
    }),
  }),

  listApiKeys: tool({
    description:
      "List all active and archived API keys with their friendly names, prefixes, and UUIDs.",
    execute: async () => {
      const trpc = await api();
      return trpc.apikey.list();
    },
    inputSchema: z.object({}),
  }),

  listNotifications: tool({
    description:
      "Retrieve the latest notifications for the user, showing their IDs, read status, and related repositories.",
    execute: async ({ isRead, limit }) => {
      const trpc = await api();
      return trpc.notification.getAll({
        isRead,
        limit: limit ?? 10,
      });
    },
    inputSchema: z.object({
      isRead: z.boolean().optional().describe("Filter by read/unread status"),
      limit: z
        .number()
        .optional()
        .describe("Maximum number of notifications to return (default is 10)"),
    }),
  }),

  listRepositories: tool({
    description:
      "Retrieve a lightweight list of your registered repositories with their names, owners, and UUIDs. Use this on the global dashboard to find a repository's UUID by its name.",
    execute: async ({ search }) => {
      const trpc = await api();
      return await trpc.repo.getSlim({ search });
    },
    inputSchema: z.object({
      search: z
        .string()
        .optional()
        .describe("Optional search term or keyword to filter repositories by name or owner"),
    }),
  }),

  listUnimportedGithubRepos: tool({
    description:
      "Fetch a list of the user's GitHub repositories that are available for import/registration in Doxynix but have not been registered yet.",
    execute: async () => {
      const trpc = await api();
      return trpc.githubApp.getMyGithubRepos();
    },
    inputSchema: z.object({}),
  }),

  markAllNotificationsAsRead: tool({
    description: "Mark all unread notifications for the user as read.",
    execute: async () => {
      const trpc = await api();
      return trpc.notification.markAllAsRead({});
    },
    inputSchema: z.object({}),
  }),

  markNotificationAsRead: tool({
    description: "Mark a specific notification as read or unread using its public identifier.",
    execute: async ({ id, isRead }) => {
      const trpc = await api();
      return trpc.notification.markAs({ id, isRead });
    },
    inputSchema: z.object({
      id: z.uuid().describe("The unique public UUID of the notification"),
      isRead: z.boolean().describe("true to mark as read, false for unread"),
    }),
  }),

  openPullRequest: tool({
    description:
      "Create a new Pull Request on GitHub containing all staged files from the staging area.",
    execute: async ({ branch, repoId, title }) => {
      const trpc = await api();
      const targetRepoId = repoId ?? currentRepoId;
      if (targetRepoId == null) throw new Error("Missing repository context.");

      return trpc.analysis.openPullRequest({ branch, repoId: targetRepoId, title });
    },
    inputSchema: z.object({
      branch: z.string().min(1).describe("The head branch name to create"),
      repoId: z.uuid().optional().describe("The public UUID of the repository"),
      title: z.string().min(1).describe("The title of the Pull Request"),
    }),
    needsApproval: true,
  }),

  pinAuditToDocuments: tool({
    description:
      "Save and pin a generated markdown file-audit report permanently to the repository documentation workspace.",
    execute: async ({ path, repoId }) => {
      const trpc = await api();
      const targetRepoId = repoId ?? currentRepoId;
      if (targetRepoId == null) throw new Error("Missing repository context.");

      return trpc.analysis.pinAuditToDocs({ path, repoId: targetRepoId });
    },
    inputSchema: z.object({
      path: z.string().describe("The path of the audited file"),
      repoId: z.uuid().describe("The public UUID of the repository").optional(),
    }),
  }),

  quickFileAudit: tool({
    description:
      "Run a rapid AI file audit to discover vulnerabilities, bugs, and clean code refactoring spots in a single file.",
    execute: async ({ branch, content, language, path, repoId }) => {
      const trpc = await api();
      const targetRepoId = repoId ?? currentRepoId;
      if (targetRepoId == null) throw new Error("Missing repository context.");

      return trpc.analysis.quickFileAudit({
        branch,
        content,
        language,
        path,
        repoId: targetRepoId,
      });
    },
    inputSchema: z.object({
      branch: z.string().describe("Selected branch"),
      content: z.string().describe("The actual raw content of the file to audit"),
      language: z.string().default("English").describe("The target language for the report"),
      path: z.string().describe("The file path to audit (e.g. 'src/server/db.ts')"),
      repoId: z.uuid().describe("The public UUID of the repository").optional(),
    }),
  }),

  readRepositoryDoc: tool({
    description:
      "Read the content of a specific pinned documentation file (README, API, ARCHITECTURE, CODE_DOC) generated for the repository workspace.",
    execute: async ({ docType, repoId }) => {
      const trpc = await api();
      const targetRepoId = repoId ?? currentRepoId;
      if (targetRepoId == null) throw new Error("Missing repository context.");

      return trpc.analysis.getDocumentContent({ repoId: targetRepoId, type: docType });
    },
    inputSchema: z.object({
      docType: z
        .enum(["README", "API", "ARCHITECTURE", "CONTRIBUTING", "CHANGELOG", "CODE_DOC"])
        .describe("The type of document to read"),
      repoId: z.uuid().optional().describe("The public UUID of the repository"),
    }),
  }),

  registerRepository: tool({
    description: "Registers a new repository in the system for tracking using its GitHub URL.",
    execute: async ({ url }) => {
      const trpc = await api();
      return trpc.repo.create({ url });
    },
    inputSchema: z.object({
      url: z.url().describe("The full GitHub URL of the repository"),
    }),
  }),

  revokeApiKey: tool({
    description:
      "Permanently revoke an API key using either its unique UUID or its friendly name (case-insensitive).",
    execute: async ({ keyIdentifier }) => {
      const trpc = await api();

      const isUuid = /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(keyIdentifier);

      if (isUuid) {
        return trpc.apikey.revoke({ id: keyIdentifier });
      }

      const allKeys = await trpc.apikey.list();
      const foundKey = allKeys.active.find(
        (key) => key.name.toLowerCase() === keyIdentifier.toLowerCase()
      );

      if (foundKey == null) {
        return { error: `No active API key found with name "${keyIdentifier}".`, success: false };
      }

      return trpc.apikey.revoke({ id: foundKey.id });
    },
    inputSchema: z.object({
      keyIdentifier: z
        .string()
        .describe("The UUID or the friendly name (e.g., 'CI-CD-key') of the API key to revoke"),
    }),
    needsApproval: true,
  }),

  searchWorkspace: tool({
    description: "Perform a high-density, multi-term search across the repository indexed files.",
    execute: async ({ aid, repoId, search }) => {
      const trpc = await api();
      const targetRepoId = repoId ?? currentRepoId;
      if (targetRepoId == null) throw new Error("Missing repository context.");

      return trpc.analysis.searchWorkspace({ aid, repoId: targetRepoId, search });
    },
    inputSchema: z.object({
      aid: z.string().optional().describe("Optional specific analysis ID"),
      repoId: z.uuid().describe("The public UUID of the repository").optional(),
      search: z.string().describe("The term or keyword to search for"),
    }),
  }),

  stageFile: tool({
    description: "Add modified file contents to the temporary commit staging area in Redis.",
    execute: async ({ content, filePath, repoId }) => {
      const trpc = await api();
      const targetRepoId = repoId ?? currentRepoId;
      if (targetRepoId == null) throw new Error("Missing repository context.");

      return trpc.analysis.stageFile({ content, filePath, repoId: targetRepoId });
    },
    inputSchema: z.object({
      content: z.string().describe("The modified file content"),
      filePath: z.string().describe("The path of the file to stage"),
      repoId: z.uuid().describe("The public UUID of the repository").optional(),
    }),
  }),

  stageGeneratedFix: tool({
    description:
      "Import all file corrections from an AI-generated fix directly into your active staging area.",
    execute: async ({ fixId, repoId }) => {
      const trpc = await api();
      const targetRepoId = repoId ?? currentRepoId;
      if (targetRepoId == null) throw new Error("Missing repository context.");

      return trpc.analysis.stageGeneratedFix({ fixId, repoId: targetRepoId });
    },
    inputSchema: z.object({
      fixId: z.string().describe("The unique public UUID of the generated fix"),
      repoId: z.uuid().describe("The public UUID of the repository").optional(),
    }),
  }),
  // TODO: вынести в общий
  triggerRepositoryAnalysis: tool({
    description: "Queue and start a complete static code analysis run for a repository.",
    execute: async ({ branch, docTypes, files, language, repoId }) => {
      const trpc = await api();
      const targetRepoId = repoId ?? currentRepoId;
      if (targetRepoId == null) throw new Error("Missing repository context.");

      return trpc.analysis.analyze({
        branch,
        docTypes: docTypes ?? ["README", "API", "ARCHITECTURE", "CONTRIBUTING", "CHANGELOG"],
        files: files ?? ["**/*"],
        language,
        repoId: targetRepoId,
      });
    },
    inputSchema: z.object({
      branch: z
        .string()
        .optional()
        .describe("Specific branch to target (defaults to default branch)"),
      docTypes: z
        .array(z.enum(["README", "API", "ARCHITECTURE", "CONTRIBUTING", "CHANGELOG"]))
        .optional()
        .describe("Array of document types to generate. Defaults to all 5 types if not specified."),
      files: z
        .array(z.string())
        .optional()
        .describe(
          "Optional list of specific file paths or glob patterns (e.g., ['src/server/**/*', 'routes/auth/**/*.js', 'app.js']) " +
            "to restrict the static analysis scope. Instruct the user to specify files or folders if they want a partial scan. " +
            "Defaults to ['**/*'] if the user wants a full repository scan."
        ),
      language: z
        .string()
        .optional()
        .default("English")
        .describe(
          "The target language for the documentation and report (e.g. 'English', 'Russian'). Defaults to 'English'."
        ),
      repoId: z.uuid().describe("The public UUID of the repository to analyze").optional(),
    }),
  }),

  unstageFile: tool({
    description: "Remove a file from the temporary commit staging area.",
    execute: async ({ filePath, repoId }) => {
      const trpc = await api();
      const targetRepoId = repoId ?? currentRepoId;
      if (targetRepoId == null) throw new Error("Missing repository context.");

      return trpc.analysis.unstageFile({ filePath, repoId: targetRepoId });
    },
    inputSchema: z.object({
      filePath: z.string().describe("The path of the file to unstage"),
      repoId: z.uuid().describe("The public UUID of the repository").optional(),
    }),
  }),

  updateApiKey: tool({
    description: "Update the name or description of an existing API key.",
    execute: async ({ description, id, name }) => {
      const trpc = await api();
      return trpc.apikey.update({ description, id, name });
    },
    inputSchema: z.object({
      description: z.string().max(1000).optional().describe("The new description for the key"),
      id: z.uuid().describe("The unique public UUID of the key"),
      name: z.string().min(1).max(50).describe("The new name for the key"),
    }),
  }),

  updateUserProfile: tool({
    description: "Update the logged-in user's profile information (like their name).",
    execute: async ({ name }) => {
      const trpc = await api();
      return trpc.user.updateUser({ name });
    },
    inputSchema: z.object({
      name: z.string().trim().min(1).max(50).describe("The new name for the user"),
    }),
  }),
});
