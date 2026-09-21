import type { Visibility } from "@doxynix/shared";
import { Lock, type LucideIcon, Unlock } from "lucide-react";

export type RepoVisibilityLabelKey = "repo_visibility_private" | "repo_visibility_public";

export const repoVisibilityConfig: Record<
  Visibility,
  {
    color: string;
    icon: LucideIcon;
    labelKey: RepoVisibilityLabelKey;
  }
> = {
  PRIVATE: { color: "text-error", icon: Lock, labelKey: "repo_visibility_private" },
  PUBLIC: { color: "text-success", icon: Unlock, labelKey: "repo_visibility_public" },
};
