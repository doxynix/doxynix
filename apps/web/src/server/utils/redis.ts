/**
 * Centralized Redis config.
 * Eliminates magic numbers and typos in string keys.
 */
export const REDIS_CONFIG = {
  keys: {
    // Audit results for a specific file
    fileAction: (
      userId: number | string,
      path: string,
      action: "document-file-preview" | "quick-file-audit",
    ): string => `file-result:${userId}:${action}:${path}`,

    // Generated fix results (code for the diff)
    fixResult: (fixId: string): string => `fix-result:${fixId}`,

    // Staging area for batch PRs
    prStaging: (userId: number | string, repoId: string): string => `pr-stage:${userId}:${repoId}`,
  },

  // Key TTL in seconds
  ttl: {
    fileAction: 86_400, // 24 hours
    fixResult: 3600, // 1 hour
    prStaging: 86_400, // 24 hours
  },
} as const;
