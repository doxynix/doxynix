import type { Status } from "@prisma/client";

export const repoStatusConfig: Record<
  Status,
  {
    label: string;
    color: string;
  }
> = {
  DONE: { label: "Done", color: "bg-success" },
  PENDING: { label: "In Progress", color: "bg-warning" },
  FAILED: { label: "Failed", color: "bg-error" },
  NEW: { label: "New", color: "bg-blue" },
};
