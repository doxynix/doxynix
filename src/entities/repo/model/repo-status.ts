import type { RepoStatus } from "@/shared/api/trpc";

export const repoStatusConfig: Record<
  RepoStatus,
  {
    color: string;
    label: string;
  }
> = {
  DONE: { color: "bg-success", label: "Done" },
  FAILED: { color: "bg-error", label: "Failed" },
  NEW: { color: "bg-blue", label: "New" },
  PENDING: { color: "bg-warning", label: "In Progress" },
};
