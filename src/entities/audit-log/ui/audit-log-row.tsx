import type { ComponentType } from "react";
import {
  Bot,
  Cpu,
  Database,
  Ghost,
  GitPullRequest,
  Key,
  Monitor,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Tablet,
  User,
} from "lucide-react";
import { useLocale } from "next-intl";

import { cn } from "@/shared/lib/cn";
import { Badge } from "@/shared/ui/core/badge";
import { TableCell, TableRow } from "@/shared/ui/core/table";
import { GitHubIcon } from "@/shared/ui/icons/github-icon";
import { CopyButton } from "@/shared/ui/kit/copy-button";
import { TimeAgo } from "@/shared/ui/kit/time-ago";

import type { UiAuditLog } from "../model/audit-log.types";
import { AuditLogDetailsSheet } from "./audit-log-sheet";

const DeviceIconMap: Record<string, ComponentType<{ className?: string }>> = {
  bot: Bot,
  desktop: Monitor,
  mobile: Smartphone,
  system: Cpu,
  tablet: Tablet,
};

export const AuditIconMap: Record<string, ComponentType<{ className?: string }>> = {
  analysis: RefreshCw,
  database: Database,
  ghost: Ghost,
  "git-pr": GitPullRequest,
  github: GitHubIcon,
  key: Key,
  shield: ShieldCheck,
  user: User,
};
type Props = { log: UiAuditLog };

export function AuditLogRow({ log }: Readonly<Props>) {
  const locale = useLocale();
  const Icon = AuditIconMap[log.iconKey] ?? AuditIconMap.database;
  const DeviceIcon = DeviceIconMap[log.deviceType] ?? DeviceIconMap.desktop;

  return (
    <TableRow className="group">
      <TableCell className="py-4">
        <div className="flex items-center gap-3">
          <div className={cn("flex size-8 items-center justify-center rounded-lg border")}>
            {Icon != null && <Icon className="size-4" />}
          </div>
          <span>{log.actionTitle}</span>
        </div>
      </TableCell>

      <TableCell>
        <Badge variant="secondary">{log.entityType}</Badge>
      </TableCell>

      <TableCell>
        <div className="flex max-w-75 flex-col">
          <span className="truncate text-sm">{log.targetName}</span>
        </div>
      </TableCell>

      <TableCell>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            {DeviceIcon != null && <DeviceIcon />}
            <span className="text-xs">{log.ip ?? "system"}</span>
          </div>
          <div className="text-muted-foreground flex flex-col text-xs">
            <span className="mb-0.5 max-w-40 truncate">{log.browser}</span>
            {log.requestId != null && (
              <div className="flex items-center gap-1">
                <span>{log.requestId.slice(0, 8)}</span>
                <CopyButton value={log.requestId} tooltipSide="right" />
              </div>
            )}
          </div>
        </div>
      </TableCell>

      <TableCell className="text-right whitespace-nowrap">
        <TimeAgo date={log.createdAt} locale={locale} className="hover:text-foreground text-xs" />
      </TableCell>

      <TableCell className="text-center">
        <AuditLogDetailsSheet log={log} />
      </TableCell>
    </TableRow>
  );
}
