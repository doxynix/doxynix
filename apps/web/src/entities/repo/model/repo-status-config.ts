import type { RepoStatus } from "./repo.types";

export type RepoStatusLabelKey =
  | "repo_status_done"
  | "repo_status_failed"
  | "repo_status_in_progress"
  | "repo_status_new";

export const repoStatusConfig: Record<
  RepoStatus,
  {
    labelKey: RepoStatusLabelKey;
    tone: "danger" | "neutral" | "success" | "warning";
  }
> = {
  DONE: { labelKey: "repo_status_done", tone: "success" },
  FAILED: { labelKey: "repo_status_failed", tone: "danger" },
  NEW: { labelKey: "repo_status_new", tone: "neutral" },
  PENDING: { labelKey: "repo_status_in_progress", tone: "warning" },
};
