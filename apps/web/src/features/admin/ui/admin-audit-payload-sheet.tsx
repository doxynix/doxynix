"use client";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import { useTRPC } from "@/shared/api/trpc";
import { cn } from "@/shared/lib/cn";
import { ScrollArea } from "@/shared/ui/core/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/shared/ui/core/sheet";
import { SkeletonText } from "@/shared/ui/kit/app-skeleton";
import { CopyButton } from "@/shared/ui/kit/copy-button";

type Props = {
  logId: string;
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

export function AdminAuditPayloadSheet({ logId, onOpenChange, open }: Readonly<Props>) {
  const trpc = useTRPC();
  const t = useTranslations("AdminAudit");

  const { data: html, isLoading } = useQuery(
    trpc.adminAudit.payloadHtml.queryOptions({ id: logId }, { enabled: open }),
  );

  return (
    <Sheet
      onOpenChange={onOpenChange}
      open={open}
    >
      <SheetContent
        className="flex flex-col gap-6 p-6"
        resizable={{
          defaultWidth: 672,
          maxWidth: 1200,
          minWidth: 380,
          storageKey: "sheet-admin-audit-width",
        }}
      >
        <SheetHeader className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <SheetTitle className="font-semibold text-xl tracking-tight">
                {t("detail_title")}
              </SheetTitle>
              <SheetDescription className="text-muted-foreground text-xs">{logId}</SheetDescription>
            </div>
            <CopyButton
              className="flex opacity-100"
              tooltipText={t("detail_copy_json")}
              value={logId}
            />
          </div>
        </SheetHeader>

        <div className="relative flex-1 rounded-xl border">
          <ScrollArea className="h-full w-full">
            <div className="p-6">
              {isLoading ? (
                <SkeletonText
                  lines={8}
                  widths={["w-full", "w-3/4", "w-1/2", "w-5/6", "w-2/3", "w-3/4", "w-1/4", "w-1/2"]}
                />
              ) : (
                <div
                  className={cn(
                    "w-full text-sm",
                    "[&_pre]:m-0! [&_pre]:bg-transparent! [&_pre]:p-0!",
                    "[&_pre]:break-all! [&_pre]:whitespace-pre-wrap!",
                    "[&_code]:break-all! [&_code]:whitespace-pre-wrap!",
                    "[&_.line]:inline! [&_.line]:break-all! [&_.line]:whitespace-pre-wrap!",
                  )}
                  dangerouslySetInnerHTML={{ __html: html ?? "" }} // NOTE: no sanitization here, so keep this in mind if user input is ever rendered in the future
                />
              )}
            </div>
          </ScrollArea>
        </div>
      </SheetContent>
    </Sheet>
  );
}
