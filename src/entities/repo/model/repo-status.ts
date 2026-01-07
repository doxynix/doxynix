import type { Status } from "@prisma/client";

export const repoStatusConfig: Record<
  Status,
  {
    label: string;
    color: string;
  }
> = {
  DONE: { label: "Готово", color: "bg-success" },
  PENDING: { label: "В работе", color: "bg-warning" },
  FAILED: { label: "Ошибка", color: "bg-error" },
  NEW: { label: "Новый", color: "bg-blue" },
};
