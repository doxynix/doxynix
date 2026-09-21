"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { LogOut, Monitor, RefreshCw, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { trpc } from "@/shared/api/trpc";
import { authClient } from "@/shared/lib/auth-client";
import { formatFullDate } from "@/shared/lib/date-utils";
import { AppButton } from "@/shared/ui/core/button";
import { DangerActionDialog } from "@/shared/ui/kit/danger-action-dialog";
import { LoadingButton } from "@/shared/ui/kit/loading-button";

import { ConnectionCard } from "@/entities/connection/ui/connection-card";

export function SessionsList() {
  const { data: currentSessionContext } = authClient.useSession();
  const currentSessionId = currentSessionContext?.session.id;
  const t = useTranslations("Sessions");

  const [revokingSessionToken, setRevokingSessionToken] = useState<null | string>(null);

  const utils = trpc.useUtils();

  const { data: sessions = [], isLoading } = trpc.user.getActiveSessions.useQuery();

  const revokeSession = useMutation({
    mutationFn: async (token: string) => {
      const { error } = await authClient.revokeSession({ token });
      if (error) {
        throw new Error(error.message);
      }
    },
    onError: (err) => toast.error(err.message),
    onSuccess: () => {
      toast.success(t("device_session_revoked"));
      setRevokingSessionToken(null);
      void utils.user.getActiveSessions.invalidate();
    },
  });

  const revokeOtherSessions = useMutation({
    mutationFn: async () => {
      const { error } = await authClient.revokeOtherSessions();
      if (error) {
        throw new Error(error.message);
      }
    },
    onError: (err) => toast.error(err.message),
    onSuccess: () => {
      toast.success(t("logged_out_all_devices"));
      void utils.user.getActiveSessions.invalidate();
    },
  });

  const otherSessionsCount = sessions.filter(
    (s) => String(s.id) !== String(currentSessionId),
  ).length;

  return (
    <div className="flex flex-col gap-6">
      {otherSessionsCount > 0 && (
        <div className="flex justify-end">
          <LoadingButton
            className="gap-2"
            disabled={revokeOtherSessions.isPending}
            isLoading={revokeOtherSessions.isPending}
            loadingText={t("revoking")}
            onClick={() => revokeOtherSessions.mutate()}
            size="sm"
            variant="destructive"
          >
            <LogOut size={16} /> {t("sign_out_all_devices")}
          </LoadingButton>
        </div>
      )}

      {isLoading ? (
        <div className="py-8 text-center text-muted-foreground text-xs">
          <RefreshCw className="mx-auto mb-2 animate-spin text-muted-foreground" />
          {t("loading_sessions")}
        </div>
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
                      onConfirm={() => revokeSession.mutate(session.token)}
                      onOpenChange={(open) => setRevokingSessionToken(open ? session.token : null)}
                      open={revokingSessionToken === session.token}
                      title={t("revoke_device_session")}
                      trigger={
                        <AppButton
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
                    className={
                      isCurrentDevice ? "size-5 text-primary" : "size-5 text-muted-foreground"
                    }
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
