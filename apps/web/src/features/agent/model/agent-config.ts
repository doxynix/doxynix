import { authClient } from "@/shared/lib/auth-client";

export type AgentToolLabelKey =
  | "tool_apply_fix"
  | "tool_clear_read_notifications"
  | "tool_clear_staging"
  | "tool_create_api_key"
  | "tool_create_fix"
  | "tool_delete_repository"
  | "tool_document_file"
  | "tool_get_analysis_comments"
  | "tool_get_branches"
  | "tool_get_file_content"
  | "tool_get_latest_analysis"
  | "tool_get_notification_stats"
  | "tool_get_repo_analytics"
  | "tool_get_repo_files"
  | "tool_get_staged_files"
  | "tool_list_api_keys"
  | "tool_list_notifications"
  | "tool_list_repositories"
  | "tool_list_unimported_github_repos"
  | "tool_mark_all_notifications_as_read"
  | "tool_mark_notification_as_read"
  | "tool_open_pull_request"
  | "tool_pin_audit_to_documents"
  | "tool_quick_file_audit"
  | "tool_read_repository_doc"
  | "tool_register_repository"
  | "tool_revoke_api_key"
  | "tool_search_workspace"
  | "tool_stage_file"
  | "tool_stage_generated_fix"
  | "tool_trigger_repository_analysis"
  | "tool_unstage_file"
  | "tool_update_api_key"
  | "tool_update_user_profile";

export const toolLabelKeys: Record<string, AgentToolLabelKey> = {
  applyFix: "tool_apply_fix",
  clearReadNotifications: "tool_clear_read_notifications",
  clearStaging: "tool_clear_staging",
  createApiKey: "tool_create_api_key",
  createFix: "tool_create_fix",
  deleteRepository: "tool_delete_repository",
  documentFile: "tool_document_file",
  getAnalysisComments: "tool_get_analysis_comments",
  getBranches: "tool_get_branches",
  getFileContent: "tool_get_file_content",
  getLatestAnalysis: "tool_get_latest_analysis",
  getNotificationStats: "tool_get_notification_stats",
  getRepoAnalytics: "tool_get_repo_analytics",
  getRepoFiles: "tool_get_repo_files",
  getStagedFiles: "tool_get_staged_files",
  listApiKeys: "tool_list_api_keys",
  listNotifications: "tool_list_notifications",
  listRepositories: "tool_list_repositories",
  listUnimportedGithubRepos: "tool_list_unimported_github_repos",
  markAllNotificationsAsRead: "tool_mark_all_notifications_as_read",
  markNotificationAsRead: "tool_mark_notification_as_read",
  openPullRequest: "tool_open_pull_request",
  pinAuditToDocuments: "tool_pin_audit_to_documents",
  quickFileAudit: "tool_quick_file_audit",
  readRepositoryDoc: "tool_read_repository_doc",
  registerRepository: "tool_register_repository",
  revokeApiKey: "tool_revoke_api_key",
  searchWorkspace: "tool_search_workspace",
  stageFile: "tool_stage_file",
  stageGeneratedFix: "tool_stage_generated_fix",
  triggerRepositoryAnalysis: "tool_trigger_repository_analysis",
  unstageFile: "tool_unstage_file",
  updateApiKey: "tool_update_api_key",
  updateUserProfile: "tool_update_user_profile",
};

export const TOOL_INVALIDATIONS: Record<string, (utils: any) => void> = {
  applyFix: (utils) => utils.analysis.listByRepository.invalidate(),
  clearReadNotifications: (utils) => {
    utils.notification.getAll.invalidate();
    utils.notification.getStats.invalidate();
  },
  clearStaging: (utils) => utils.analysis.getStagedFiles.invalidate(),
  createApiKey: (utils) => utils.apikey.list.invalidate(),
  deleteRepository: (utils) => {
    utils.repo.getAll.invalidate();
    utils.repo.getSlim.invalidate();
    utils.agentChat.listSessions.invalidate();
  },
  markAllNotificationsAsRead: (utils) => {
    utils.notification.getAll.invalidate();
    utils.notification.getStats.invalidate();
  },
  markNotificationAsRead: (utils) => {
    utils.notification.getAll.invalidate();
    utils.notification.getStats.invalidate();
  },
  openPullRequest: (utils) => utils.analysis.listByRepository.invalidate(),
  registerRepository: (utils) => {
    utils.repo.getAll.invalidate();
    utils.repo.getSlim.invalidate();
  },
  revokeApiKey: (utils) => utils.apikey.list.invalidate(),
  stageFile: (utils) => utils.analysis.getStagedFiles.invalidate(),
  stageGeneratedFix: (utils) => utils.analysis.getStagedFiles.invalidate(),
  triggerRepositoryAnalysis: (utils) => utils.analysis.getLatest.invalidate(),
  unstageFile: (utils) => utils.analysis.getStagedFiles.invalidate(),
  updateApiKey: (utils) => utils.apikey.list.invalidate(),

  updateUserProfile: (utils) => {
    void utils.user.me.invalidate();
    if (typeof window !== "undefined") {
      void authClient.getSession({
        query: {
          disableCookieCache: true,
        },
      });
    }
  },
};
