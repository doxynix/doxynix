export const toolLabels: Record<string, string> = {
  applyFix: "Applying code corrections on GitHub",
  clearReadNotifications: "Clearing read notifications",
  clearStaging: "Clearing staged changes",
  createApiKey: "Generating secure API key",
  createFix: "Generating code refactoring suggestions",
  deleteRepository: "Deleting repository from system",
  documentFile: "Generating file documentation",
  getAnalysisComments: "Retrieving code analysis findings",
  getBranches: "Fetching repository branches",
  getFileContent: "Reading file content",
  getLatestAnalysis: "Checking latest analysis status",
  getNotificationStats: "Loading notification statistics",
  getRepoAnalytics: "Loading repository quality metrics",
  getRepoFiles: "Reading repository structure",
  getStagedFiles: "Listing files in staging area",
  listApiKeys: "Listing active API keys",
  listNotifications: "Retrieving notification list",
  listRepositories: "Listing registered repositories",
  listUnimportedGithubRepos: "Scanning GitHub for available repositories",
  markAllNotificationsAsRead: "Marking all notifications as read",
  markNotificationAsRead: "Updating notification status",
  openPullRequest: "Opening GitHub Pull Request",
  pinAuditToDocuments: "Pinning audit report to documents",
  quickFileAudit: "Running quick file audit",
  readRepositoryDoc: "Reading workspace documentation",
  registerRepository: "Registering new repository",
  revokeApiKey: "Revoking API key",
  searchWorkspace: "Searching repository workspace",
  stageFile: "Staging modified file content",
  stageGeneratedFix: "Importing generated fixes to staging",
  triggerRepositoryAnalysis: "Starting complete repository analysis",
  unstageFile: "Removing file from staging",
  updateApiKey: "Updating API key details",
  updateUserProfile: "Updating user profile information",
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

  updateUserProfile: (utils) => utils.user.me.invalidate(),
};
