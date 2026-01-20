import { Visibility } from "@prisma/client";
import { Lock, LucideIcon, Unlock } from "lucide-react";

export const repoVisibilityConfig: Record<
  Visibility,
  {
    label: string;
    icon: LucideIcon;
    color: string;
  }
> = {
  PRIVATE: { label: "Private", icon: Lock, color: "text-error" },
  PUBLIC: { label: "Public", icon: Unlock, color: "text-success" },
};
