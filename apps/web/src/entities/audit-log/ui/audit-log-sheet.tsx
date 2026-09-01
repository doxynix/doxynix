"use client";

import { type ComponentType, useState } from "react";
import { Clock, Download, Eye, Globe, Hash, Shield } from "lucide-react";
import { useLocale } from "next-intl";

import { trpc } from "@/shared/api/trpc";
import { cn } from "@/shared/lib/cn";
import { formatFullDate } from "@/shared/lib/date-utils";
import { saveFile } from "@/shared/lib/file-saver";
import { AppButton } from "@/shared/ui/core/button";
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
    { enabled: open },
  );

  const handleExportJson = () => {
    const blob = new Blob([JSON.stringify(log.rawPayload, null, 2)], {
      type: "application/json;charset=utf-8",
    });
    saveFile(blob, `audit-${log.entityType.toLowerCase()}-${log.id.slice(0, 8)}.json`);
  };

  return (
    <Sheet onOpenChange={setOpen} open={open}>
      <AppTooltip content="View Raw">
        <SheetTrigger asChild>
          <AppButton
            className="opacity-0 transition-opacity group-hover:opacity-100"
            size="icon"
            variant="ghost"
          >
            <Eye className="text-muted-foreground hover:text-foreground" />
          </AppButton>
        </SheetTrigger>
      </AppTooltip>
      <SheetContent className="flex flex-col gap-6 p-6 sm:max-w-2xl">
        <div className="grid h-full grid-rows-[auto_1fr] gap-6">
          <SheetHeader className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-1">
                <SheetTitle className="font-semibold text-xl tracking-tight">
                  Event Details
                </SheetTitle>
                <SheetDescription className="text-muted-foreground text-xs">
                  {log.entityType} • {log.actionTitle}
                </SheetDescription>
              </div>
              <div className="flex items-center gap-2">
                <CopyButton
                  className="flex opacity-100"
                  tooltipText="Copy JSON"
                  value={formattedJson}
                />
                <AppButton
                  className="h-8 gap-2 bg-transparent text-xs"
                  onClick={handleExportJson}
                  size="sm"
                  variant="outline"
                >
                  <Download />
                  Export JSON
                </AppButton>
              </div>
            </div>

            <div className="grid grid-cols-2 divide-x divide-y divide-border overflow-hidden rounded-xl border border-border bg-muted/5">
              <MetaItem
                className="p-4"
                copyValue={log.requestId ?? ""}
                icon={Hash}
                isCopy
                label="Request ID"
                value={log.requestId ?? "N/A"}
              />
              <MetaItem
                className="p-4"
                icon={Globe}
                label="IP Address"
                value={log.ip ?? "system"}
              />
              <MetaItem className="p-4" icon={Shield} label="User Agent" value={log.browser} />
              <MetaItem
                className="p-4"
                icon={Clock}
                label="Timestamp"
                value={formatFullDate(log.createdAt, locale)}
              />
            </div>
          </SheetHeader>
          <div className="relative flex-1 rounded-xl border">
            <ScrollArea className="h-full w-full">
              <div className="p-6">
                {isLoading ? (
                  <Skeleton className="h-40 w-full" />
                ) : (
                  <div
                    className={cn(
                      "w-full text-sm",
                      "[&_pre]:m-0! [&_pre]:bg-transparent! [&_pre]:p-0!",
                      "[&_pre]:break-all! [&_pre]:whitespace-pre-wrap!",
                      "[&_code]:break-all! [&_code]:whitespace-pre-wrap!",
                      "[&_.line]:inline! [&_.line]:break-all! [&_.line]:whitespace-pre-wrap!",
                    )}
                    dangerouslySetInnerHTML={{ __html: html ?? "" }} // NOTE: санитизации нету здесь так что если в будущем будет вставлять юзерский ввод то иметь ввиду
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
      <div className="flex items-center gap-1 text-muted-foreground">
        <Icon />
        <span className="text-xs">{label}</span>
        {isCopy === true && (
          <CopyButton className="ml-auto flex opacity-100" value={copyValue ?? ""} />
        )}
      </div>
      <p className={cn("truncate text-foreground text-xs")}>{value}</p>
    </div>
  );
}
