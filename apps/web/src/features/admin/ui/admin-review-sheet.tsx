"use client";

import { useLocale, useTranslations } from "next-intl";

import { trpc } from "@/shared/api/trpc";
import { formatFullDate } from "@/shared/lib/date-utils";
import { AppBadge } from "@/shared/ui/core/badge";
import { ScrollArea } from "@/shared/ui/core/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/shared/ui/core/sheet";
import { Skeleton } from "@/shared/ui/core/skeleton";
import { CopyButton } from "@/shared/ui/kit/copy-button";

type Props = {
  onOpenChange: (open: boolean) => void;
  open: boolean;
  reviewId: string;
};

export function AdminReviewSheet({ onOpenChange, open, reviewId }: Readonly<Props>) {
  const t = useTranslations("AdminReview");
  const locale = useLocale();

  const { data, isLoading } = trpc.adminReview.detail.useQuery({ id: reviewId }, { enabled: open });

  return (
    <Sheet
      onOpenChange={onOpenChange}
      open={open}
    >
      <SheetContent
        className="flex flex-col gap-6 p-6"
        resizable={{
          defaultWidth: 640,
          maxWidth: 1000,
          minWidth: 380,
          storageKey: "sheet-admin-review-width",
        }}
      >
        <SheetHeader className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <SheetTitle className="font-semibold text-xl tracking-tight">
                {data ? `${data.owner}/${data.repoName} #${data.prNumber}` : t("detail_loading")}
              </SheetTitle>
              <SheetDescription className="text-muted-foreground text-xs">
                {data == null
                  ? ""
                  : t("detail_created", { date: formatFullDate(data.createdAt, locale) })}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        {isLoading || data == null ? (
          <div className="flex flex-col gap-4">
            <Skeleton className="h-6 w-1/3" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : (
          <ScrollArea className="flex-1">
            <div className="flex flex-col gap-6 pr-4">
              <div className="flex flex-wrap items-center gap-2">
                <AppBadge variant={data.status === "FAILED" ? "destructive" : "secondary"}>
                  {t(`status_${data.status.toLowerCase()}`)}
                </AppBadge>
                <AppBadge variant="outline">
                  {t("detail_risk", { score: data.riskScore ?? t("risk_unknown") })}
                </AppBadge>
              </div>

              <dl className="grid grid-cols-2 gap-4 text-sm">
                <ShaRow
                  label={t("detail_head_sha")}
                  value={data.headSha}
                />
                <ShaRow
                  label={t("detail_base_sha")}
                  value={data.baseSha}
                />
                <ShaRow
                  label={t("detail_updated")}
                  value={formatFullDate(data.updatedAt, locale)}
                />
                <div className="flex flex-col gap-1">
                  <dt className="text-muted-foreground text-xs">{t("detail_fixes")}</dt>
                  <dd className="truncate">{data.fixCount}</dd>
                </div>
              </dl>

              {data.error != null && (
                <div className="flex flex-col gap-1 rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm">
                  <span className="font-medium">{t("detail_error")}</span>
                  <span className="break-all text-muted-foreground">{data.error}</span>
                </div>
              )}

              <div className="flex flex-col gap-2">
                <span className="font-medium text-sm">{t("detail_fix_list")}</span>
                {data.fixes.length === 0 ? (
                  <span className="text-muted-foreground text-sm">{t("fixes_none")}</span>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {data.fixes.map((fix) => (
                      <li
                        className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border p-3 text-sm"
                        key={fix.id}
                      >
                        <div className="flex flex-col">
                          <span className="font-medium">{fix.title}</span>
                          <span className="text-muted-foreground text-xs">{fix.branch}</span>
                        </div>
                        <AppBadge variant="outline">
                          {t(`fix_status_${fix.status.toLowerCase()}`)}
                        </AppBadge>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </ScrollArea>
        )}
      </SheetContent>
    </Sheet>
  );
}

type ShaRowProps = {
  label: string;
  value: string;
};

function ShaRow({ label, value }: Readonly<ShaRowProps>) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="flex items-center gap-1 text-muted-foreground text-xs">
        {label}
        <CopyButton
          className="ml-auto flex opacity-100"
          value={value}
        />
      </dt>
      <dd className="truncate font-mono text-xs">{value}</dd>
    </div>
  );
}
