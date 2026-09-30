/**
 * User-facing copy for CLI output.
 *
 * These strings are owned here, not returned by the server. The tRPC success
 * responses deliberately carry data only — a server that ships English prose
 * to a CLI has to pick one locale for everyone, and the CLI is the only place
 * that knows what the user actually typed.
 */
export const MESSAGES = {
  apiKey: {
    revoked: "API Key revoked",
    updated: "API key updated",
  },
  notification: {
    deleted: "Notification deleted",
    markedAsRead: "Marked as read",
    markedAsUnread: "Marked as unread",
  },
  notificationBulk: {
    deletedRead: (count: number): string => `Deleted ${count} read notifications`,
    markedAll: (count: number): string => `Marked ${count} notifications as read`,
  },
  profile: {
    accountDeleted: "Account and all associated data deleted",
    avatarRemoved: "Profile picture removed",
  },
  repo: {
    deleted: "Repository deleted",
    deletedAll: "All repositories have been deleted",
  },
  repoBulk: {
    deletedForOwner: (count: number, owner: string): string =>
      `Deleted ${count} ${count === 1 ? "repository" : "repositories"} for ${owner}`,
  },
} as const;
