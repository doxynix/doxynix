import type { Visibility } from "@doxynix/shared";
import { Lock, type LucideIcon, Unlock } from "lucide-react";

export const repoVisibilityConfig: Record<
  Visibility,
  {
    color: string;
    icon: LucideIcon;
    label: string;
  }
> = {
  PRIVATE: { color: "text-error", icon: Lock, label: "Private" },
  PUBLIC: { color: "text-success", icon: Unlock, label: "Public" },
};
