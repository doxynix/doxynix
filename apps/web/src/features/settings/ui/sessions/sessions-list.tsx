"use client";

import { useState } from "react";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { LogOut, Monitor, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";

import { useTRPC } from "@/shared/api/trpc";
import { SESSIONS_PAGE_SIZE } from "@/shared/config/pagination";
import { useErrorMessage } from "@/shared/i18n/use-error-message";
import { authClient } from "@/shared/lib/auth-client";
import { formatFullDate } from "@/shared/lib/date-utils";
import { AppButton } from "@/shared/ui/core/button";
import { Card } from "@/shared/ui/core/card";
import { Skeleton } from "@/shared/ui/core/skeleton";
import { AppInfiniteSentinel } from "@/shared/ui/kit/app-infinite-sentinel";
import { SkeletonText } from "@/shared/ui/kit/app-skeleton";
import { DangerActionDialog } from "@/shared/ui/kit/danger-action-dialog";
import { LoadingButton } from "@/shared/ui/kit/loading-button";
import { StatusBadge } from "@/shared/ui/kit/status-badge";

function SessionRowSkeleton() {
  return (
    <div className="flex items-center gap-3 p-4">
      <Skeleton className="size-9 shrink-0 rounded-lg" />

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <SkeletonText
          lines={1}
          widths={["w-40"]}
        />
        <SkeletonText
          lines={1}
          size="sm"
          widths={["w-64"]}
        />
      </div>

      <Skeleton className="size-7 shrink-0 rounded-lg" />
    </div>
  );
}

export function SessionsList() {
  const trpc = useTRPC();
  const locale = useLocale();
  const { data: currentSessionContext } = authClient.useSession();
  const currentSessionId = currentSessionContext?.session.id;
  const t = useTranslations("Sessions");
  const errorMessage = useErrorMessage();

  const [revokingSessionId, setRevokingSessionId] = useState<null | string>(null);

  const queryClient = useQueryClient();

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteQuery(
    trpc.user.getActiveSessions.infiniteQueryOptions(
      { limit: SESSIONS_PAGE_SIZE },
      { getNextPageParam: (lastPage) => lastPage.meta.nextCursor },
    ),
  );

  const sessions = data?.pages.flatMap((page) => page.items) ?? [];

  const revokeSession = useMutation(
    trpc.user.revokeSession.mutationOptions({
      onError: (err) => toast.error(errorMessage(err)),
      onSuccess: () => {
        toast.success(t("device_session_revoked"));
        setRevokingSessionId(null);
        void queryClient.invalidateQueries(trpc.user.getActiveSessions.pathFilter());
      },
    }),
  );

  const revokeOtherSessions = useMutation(
    trpc.user.revokeOtherSessions.mutationOptions({
      onError: (err) => toast.error(errorMessage(err)),
      onSuccess: () => {
        toast.success(t("logged_out_all_devices"));
        void queryClient.invalidateQueries(trpc.user.getActiveSessions.pathFilter());
      },
    }),
  );

  const otherSessionsCount = sessions.filter(
    (session) => String(session.id) !== String(currentSessionId),
  ).length;

  if (isLoading) {
    return (
      <Card className="gap-0 overflow-hidden p-0">
        <SessionRowSkeleton />
        <SessionRowSkeleton />
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="gap-0 overflow-hidden p-0">
        <div className="flex flex-col divide-y divide-border">
          {sessions.map((session) => {
            const isCurrentDevice = String(session.id) === String(currentSessionId);
            const dateStr = formatFullDate(new Date(session.createdAt).toISOString(), locale);

            return (
              <div
                className="flex items-center gap-3 p-4"
                key={session.id}
              >
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface-hover text-muted-foreground">
                  <Monitor />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-medium text-sm">{session.userAgent}</p>

                    {isCurrentDevice && (
                      <StatusBadge
                        size="sm"
                        tone="success"
                      >
                        {t("this_device")}
                      </StatusBadge>
                    )}
                  </div>

                  <p className="mt-0.5 truncate text-muted-foreground text-xs">
                    {t("ip_created", {
                      date: dateStr,
                      ip: session.ipAddress ?? t("unknown"),
                    })}
                  </p>
                </div>

                {!isCurrentDevice && (
                  <DangerActionDialog
                    confirmLabel={t("revoke")}
                    description={t("revoke_description", { userAgent: session.userAgent })}
                    destructiveAlertContent={<p>{t("revoke_alert_content")}</p>}
                    isLoading={revokeSession.isPending}
                    onConfirm={() => revokeSession.mutate({ sessionId: session.id })}
                    onOpenChange={(open) => setRevokingSessionId(open ? session.id : null)}
                    open={revokingSessionId === session.id}
                    title={t("revoke_device_session")}
                    trigger={
                      <AppButton
                        aria-label={t("revoke_device_session")}
                        size="icon-xs"
                        variant="ghost"
                      >
                        <Trash2 />
                      </AppButton>
                    }
                  />
                )}
              </div>
            );
          })}
        </div>

        {otherSessionsCount > 0 && (
          <div className="flex justify-end border-t p-3">
            <LoadingButton
              className="w-full gap-2 sm:w-auto"
              disabled={revokeOtherSessions.isPending}
              isLoading={revokeOtherSessions.isPending}
              onClick={() => revokeOtherSessions.mutate()}
              size="sm"
              variant="destructive"
            >
              <LogOut /> {t("sign_out_all_devices")}
            </LoadingButton>
          </div>
        )}
      </Card>

      <AppInfiniteSentinel
        hasNextPage={hasNextPage}
        isFetchingNextPage={isFetchingNextPage}
        onLoadMore={fetchNextPage}
      />
    </div>
  );
}
