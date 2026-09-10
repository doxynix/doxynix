import type { ComponentType } from "react";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";

import type { NotificationType } from "@/entities/notifications/model/notifications.types";

export const notificationTypeConfig: Record<
  NotificationType,
  {
    border?: string;
    color: string;
    icon: ComponentType<{ className?: string }>;
  }
> = {
  ERROR: {
    border: "border-l-destructive/50",
    color: "text-destructive",
    icon: XCircle,
  },
  INFO: { border: "border-l-border-strong", color: "text-foreground", icon: Info },
  SUCCESS: {
    border: "border-l-success/50",
    color: "text-success",
    icon: CheckCircle2,
  },
  WARNING: {
    border: "border-l-warning/50",
    color: "text-warning",
    icon: AlertTriangle,
  },
};
