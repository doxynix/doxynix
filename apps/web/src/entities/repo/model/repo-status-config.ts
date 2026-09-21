import type { RepoStatus } from "./repo.types";

export type RepoStatusLabelKey =
  | "repo_status_done"
  | "repo_status_failed"
  | "repo_status_in_progress"
  | "repo_status_new";

export const repoStatusConfig: Record<
  RepoStatus,
  {
    color: string;
    labelKey: RepoStatusLabelKey;
  }
> = {
  DONE: { color: "text-success", labelKey: "repo_status_done" },
  FAILED: { color: "text-error", labelKey: "repo_status_failed" },
  NEW: { color: "text-foreground", labelKey: "repo_status_new" },
  PENDING: { color: "text-warning", labelKey: "repo_status_in_progress" },
};
