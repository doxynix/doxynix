"use client";

import { useState, type ComponentType } from "react";
import saveAs from "file-saver";
import { Clock, Download, Eye, Globe, Hash, Shield } from "lucide-react";
import { useLocale } from "next-intl";

import { trpc } from "@/shared/api/trpc";
import { cn } from "@/shared/lib/cn";
import { formatFullDate } from "@/shared/lib/date-utils";
import { Button } from "@/shared/ui/core/button";
import { ScrollArea } from "@/shared/ui/core/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/shared/ui/core/sheet";
import { Skeleton } from "@/shared/ui/core/skeleton";
import { AppTooltip } from "@/shared/ui/kit/app-tooltip";
import { CopyButton } from "@/shared/ui/kit/copy-button";

import type { UiAuditLog } from "../model/audit-log.types";

type Props = {
  log: UiAuditLog;
};

export function AuditLogDetailsSheet({ log }: Readonly<Props>) {
  const [open, setOpen] = useState(false);
  const locale = useLocale();

  const formattedJson = JSON.stringify(log.rawPayload, null, 2);

  const { data: html, isLoading } = trpc.audit.getLogPayloadHtml.useQuery(
    { logId: log.id },
    { enabled: open }
  );

  const handleExportJson = () => {
    const blob = new Blob([JSON.stringify(log.rawPayload, null, 2)], {
      type: "application/json;charset=utf-8",
    });
    saveAs(blob, `audit-${log.entityType.toLowerCase()}-${log.id.slice(0, 8)}.json`);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <AppTooltip content="View Raw">
        <SheetTrigger asChild>
          <Button
            size="icon"
            variant="ghost"
            className="opacity-0 transition-opacity group-hover:opacity-100"
          >
            <Eye className="text-muted-foreground hover:text-foreground" />
          </Button>
        </SheetTrigger>
      </AppTooltip>
      <SheetContent className="p-4 sm:max-w-xl">
        <div className="flex h-full flex-col">
          <SheetHeader>
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <SheetTitle>Event Details</SheetTitle>
                <SheetDescription className="text-muted-foreground text-xs">
                  {log.entityType} • {log.actionTitle}
                </SheetDescription>
              </div>
              <div className="flex items-center gap-1">
                <CopyButton
                  value={formattedJson}
                  tooltipText="Copy JSON"
                  className="flex opacity-100"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleExportJson}
                  className="h-8 gap-2 bg-transparent text-xs"
                >
                  <Download />
                  Export JSON
                </Button>
              </div>
            </div>
            <div className="border-border grid grid-cols-2 gap-0 overflow-hidden rounded-xl border">
              <MetaItem
                value={log.requestId ?? "N/A"}
                isCopy
                copyValue={log.requestId ?? ""}
                icon={Hash}
                label="Request ID"
                className="border-r border-b p-4"
              />
              <MetaItem
                value={log.ip ?? "system"}
                icon={Globe}
                label="IP Address"
                className="border-b p-4"
              />
              <MetaItem
                value={log.browser}
                icon={Shield}
                label="User Agent"
                className="border-r p-4"
              />
              <MetaItem
                value={formatFullDate(log.createdAt, locale)}
                icon={Clock}
                label="Timestamp"
                className="p-4"
              />
            </div>
          </SheetHeader>
          <div className="relative flex-1 rounded-xl border">
            <ScrollArea className="h-full">
              <div className="p-6">
                {isLoading ? (
                  <Skeleton className="h-40 w-full" />
                ) : (
                  <div
                    dangerouslySetInnerHTML={{ __html: html ?? "" }}
                    className={cn("text-sm", "[&>pre]:bg-transparent!")}
                  />
                )}
              </div>
            </ScrollArea>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

type MetaItemProps = {
  className?: string;
  copyValue?: string;
  icon: ComponentType<{ className?: string }>;
  isCopy?: boolean;
  label: string;
  value: string;
};

function MetaItem({
  className,
  copyValue,
  icon: Icon,
  isCopy,
  label,
  value,
}: Readonly<MetaItemProps>) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <div className="text-muted-foreground flex items-center gap-1">
        <Icon />
        <span className="text-xs">{label}</span>
        {isCopy === true && (
          <CopyButton value={copyValue ?? ""} className="ml-auto flex opacity-100" />
        )}
      </div>
      <p className={cn("text-foreground truncate text-xs")}>{value}</p>
    </div>
  );
}
