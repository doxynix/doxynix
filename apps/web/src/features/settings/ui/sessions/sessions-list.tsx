"use client";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LogOut, Monitor, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { useTRPC } from "@/shared/api/trpc";
import { authClient } from "@/shared/lib/auth-client";
import { formatFullDate } from "@/shared/lib/date-utils";
import { AppButton } from "@/shared/ui/core/button";
import { Card, CardContent } from "@/shared/ui/core/card";
import { Skeleton } from "@/shared/ui/core/skeleton";
import { SkeletonList, SkeletonText } from "@/shared/ui/kit/app-skeleton";
import { DangerActionDialog } from "@/shared/ui/kit/danger-action-dialog";
import { LoadingButton } from "@/shared/ui/kit/loading-button";

import { ConnectionCard } from "@/entities/connection/ui/connection-card";

function SessionCardSkeleton() {
  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <Skeleton className="size-5 rounded-md" />
          <SkeletonText
            className="min-w-0 flex-1"
            lines={1}
            widths={["w-64"]}
          />
          <SkeletonText
            className="min-w-0 flex-1"
            lines={1}
            size="sm"
            widths={["w-48"]}
          />
        </div>
        <div className="flex items-center px-2">
          <Skeleton className="h-8 w-16 rounded-xl" />
        </div>
      </CardContent>
    </Card>
  );
}

export function SessionsList() {
  const trpc = useTRPC();
  const { data: currentSessionContext } = authClient.useSession();
  const currentSessionId = currentSessionContext?.session.id;
  const t = useTranslations("Sessions");

  const [revokingSessionId, setRevokingSessionId] = useState<null | string>(null);

  const queryClient = useQueryClient();

  const { data: sessions = [], isLoading } = useQuery(trpc.user.getActiveSessions.queryOptions());

  const revokeSession = useMutation(
    trpc.user.revokeSession.mutationOptions({
      onError: (err) => toast.error(err.message),
      onSuccess: () => {
        toast.success(t("device_session_revoked"));
        setRevokingSessionId(null);
        void queryClient.invalidateQueries(trpc.user.getActiveSessions.pathFilter());
      },
    }),
  );

  const revokeOtherSessions = useMutation(
    trpc.user.revokeOtherSessions.mutationOptions({
      onError: (err) => toast.error(err.message),
      onSuccess: () => {
        toast.success(t("logged_out_all_devices"));
        void queryClient.invalidateQueries(trpc.user.getActiveSessions.pathFilter());
      },
    }),
  );

  const otherSessionsCount = sessions.filter(
    (s) => String(s.id) !== String(currentSessionId),
  ).length;

  return (
    <div className="flex flex-col gap-6">
      {(otherSessionsCount > 0 || isLoading) && (
        <div className="flex justify-end">
          {isLoading ? (
            <Skeleton className="h-8 w-50 rounded-xl" />
          ) : (
            <LoadingButton
              className="gap-2"
              disabled={revokeOtherSessions.isPending}
              isLoading={revokeOtherSessions.isPending}
              onClick={() => revokeOtherSessions.mutate()}
              size="sm"
              variant="destructive"
            >
              <LogOut size={16} /> {t("sign_out_all_devices")}
            </LoadingButton>
          )}
        </div>
      )}

      {isLoading ? (
        <SkeletonList
          className="grid gap-3"
          count={2}
          renderItem={() => <SessionCardSkeleton />}
        />
      ) : (
        <div className="grid gap-3">
          {sessions.map((session) => {
            const isCurrentDevice = String(session.id) === String(currentSessionId);
            const dateStr = formatFullDate(new Date(session.createdAt).toISOString(), "en");

            return (
              <ConnectionCard
                action={
                  isCurrentDevice ? (
                    <AppButton
                      disabled
                      size="sm"
                    >
                      {t("current")}
                    </AppButton>
                  ) : (
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
                          size="sm"
                          variant="destructive"
                        >
                          <Trash2 />
                        </AppButton>
                      }
                    />
                  )
                }
                description={t("ip_created", {
                  date: dateStr,
                  ip: session.ipAddress ?? t("unknown"),
                })}
                icon={
                  <Monitor
                    className={isCurrentDevice ? "size-5" : "size-5 text-muted-foreground"}
                  />
                }
                key={session.id}
                status={isCurrentDevice ? t("this_device") : undefined}
                title={session.userAgent}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
