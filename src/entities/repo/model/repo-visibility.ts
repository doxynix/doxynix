import { Lock, Unlock, type LucideIcon } from "lucide-react";

import type { RepoVisibility } from "@/shared/api/trpc";

export const repoVisibilityConfig: Record<
  RepoVisibility,
  {
    color: string;
    icon: LucideIcon;
    label: string;
  }
> = {
  PRIVATE: { color: "text-error", icon: Lock, label: "Private" },
  PUBLIC: { color: "text-success", icon: Unlock, label: "Public" },
};
