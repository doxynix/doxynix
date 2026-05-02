import { Lock, Unlock, type LucideIcon } from "lucide-react";

import type { VisibilityType } from "@/generated/zod";

export const repoVisibilityConfig: Record<
  VisibilityType,
  {
    color: string;
    icon: LucideIcon;
    label: string;
  }
> = {
  PRIVATE: { color: "text-error", icon: Lock, label: "Private" },
  PUBLIC: { color: "text-success", icon: Unlock, label: "Public" },
};
