"use client";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { LogOut } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { useTRPC } from "@/shared/api/trpc";
import { formatFullDate } from "@/shared/lib/date-utils";
import { useIntersectionObserver } from "@/shared/lib/hooks/use-intersection-observer";
import { AppBadge } from "@/shared/ui/core/badge";
import { AppButton } from "@/shared/ui/core/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/ui/core/dialog";
import { Skeleton } from "@/shared/ui/core/skeleton";
import { Spinner } from "@/shared/ui/core/spinner";
import { SkeletonText } from "@/shared/ui/kit/app-skeleton";
import { AppTooltip } from "@/shared/ui/kit/app-tooltip";
import { LoadingButton } from "@/shared/ui/kit/loading-button";

import type { AdminUserActions } from "../model/use-admin-user-actions";

type Props = {
  actions: AdminUserActions;
  userId: string;
};

const SESSIONS_PAGE_SIZE = 20;

export function AdminUserSessions({ actions, userId }: Readonly<Props>) {
  const trpc = useTRPC();
  const t = useTranslations("AdminUsers");
  const locale = useLocale();

  const sentinelRef = useRef<HTMLLIElement>(null);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteQuery(
    trpc.adminUser.listSessions.infiniteQueryOptions(
      { id: userId, limit: SESSIONS_PAGE_SIZE },
      { getNextPageParam: (lastPage) => lastPage.meta.nextCursor },
    ),
  );

  const sessions = data?.pages.flatMap((page) => page.items) ?? [];

  const { observe, unobserve } = useIntersectionObserver(
    (entries) => {
      if (entries[0]?.isIntersecting) {
        void fetchNextPage();
      }
    },
    { threshold: 0.1 },
  );

  useEffect(() => {
    const target = sentinelRef.current;
    if (!hasNextPage || isFetchingNextPage || target == null) {
      return;
    }

    observe(target);

    return () => {
      unobserve(target);
    };
  }, [fetchNextPage, hasNextPage, isFetchingNextPage, observe, unobserve]);

  return (
    <div className="flex flex-col gap-2">
      <span className="font-medium text-sm">{t("sessions_title")}</span>

      {isLoading || data == null ? (
        <ul className="flex flex-col gap-2">
          <li className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border p-3 text-sm">
            <div className="flex flex-col">
              <SkeletonText
                lines={2}
                size="sm"
                widths={["w-48", "w-64"]}
              />
            </div>
            <div className="flex items-center gap-2">
              <SkeletonText
                lines={1}
                widths={["w-20"]}
              />
              <Skeleton className="rounded-xl size-9" />
            </div>
          </li>
        </ul>
      ) : sessions.length === 0 ? (
        <span className="text-muted-foreground text-sm">{t("sessions_empty")}</span>
      ) : (
        <ul className="flex flex-col gap-2">
          {sessions.map((session) => (
            <li
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border p-3 text-sm"
              key={session.id}
            >
              <div className="flex flex-col">
                <span className="text-xs">
                  {t("sessions_since", { date: formatFullDate(session.createdAt, locale) })}
                </span>
                <span className="text-muted-foreground text-xs">
                  {session.ipAddress ?? t("sessions_unknown_origin")}
                  {session.userAgent != null && ` · ${session.userAgent}`}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {session.expired ? (
                  <AppBadge variant="outline">{t("sessions_expired")}</AppBadge>
                ) : (
                  <AppBadge variant="secondary">{t("sessions_active")}</AppBadge>
                )}
                <AdminUserRevokeSessionDialog
                  actions={actions}
                  sessionId={session.id}
                  trigger={
                    <AppTooltip content={t("sessions_revoke")}>
                      <AppButton
                        aria-label={t("sessions_revoke")}
                        className="text-destructive"
                        size="icon"
                        variant="ghost"
                      >
                        <LogOut />
                      </AppButton>
                    </AppTooltip>
                  }
                />
              </div>
            </li>
          ))}

          {hasNextPage && (
            <li
              className="flex items-center justify-center py-2"
              ref={sentinelRef}
            >
              {isFetchingNextPage && <Spinner />}
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

type DialogProps = {
  actions: AdminUserActions;
  sessionId: string;
  trigger: ReactNode;
};

function AdminUserRevokeSessionDialog({ actions, sessionId, trigger }: Readonly<DialogProps>) {
  const t = useTranslations("AdminUsers");
  const [open, setOpen] = useState(false);

  return (
    <Dialog
      onOpenChange={setOpen}
      open={open}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("sessions_revoke_title")}</DialogTitle>
          <DialogDescription>{t("sessions_revoke_desc")}</DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <AppButton
            onClick={() => setOpen(false)}
            variant="outline"
          >
            {t("cancel_action")}
          </AppButton>
          <LoadingButton
            isLoading={actions.revokeSession.isPending}
            onClick={() =>
              actions.revokeSession.mutate({ sessionId }, { onSuccess: () => setOpen(false) })
            }
            variant="destructive"
          >
            {t("sessions_revoke_confirm")}
          </LoadingButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
