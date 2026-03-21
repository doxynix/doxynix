import type { RepoStatus } from "@/shared/api/trpc";

export const repoStatusConfig: Record<
  RepoStatus,
  {
    color: string;
    label: string;
  }
> = {
  DONE: { color: "text-success", label: "Done" },
  FAILED: { color: "text-error", label: "Failed" },
  NEW: { color: "text-foreground", label: "New" },
  PENDING: { color: "text-warning", label: "In Progress" },
};
