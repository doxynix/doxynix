import type { Visibility } from "@prisma/client";
import { Lock, Unlock, type LucideIcon } from "lucide-react";

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
