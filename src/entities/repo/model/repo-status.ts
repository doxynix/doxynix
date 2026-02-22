import type { Status } from "@prisma/client";

export const repoStatusConfig: Record<
  Status,
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
