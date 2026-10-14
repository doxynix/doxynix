"use client";

import { UserRole } from "@doxynix/shared";
import { useLocale, useTranslations } from "next-intl";

import { trpc } from "@/shared/api/trpc";
import { formatFullDate } from "@/shared/lib/date-utils";
import { AppBadge } from "@/shared/ui/core/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/shared/ui/core/sheet";
import { Skeleton } from "@/shared/ui/core/skeleton";

import type { AdminUserDetail } from "@/entities/user/model/user.types";

import type { AdminUserActions } from "../model/use-admin-user-actions";
import { AdminUserSessions } from "./admin-user-sessions";

type Props = {
  actions: AdminUserActions;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  userId: string;
};

export function AdminUserSheet({ actions, onOpenChange, open, userId }: Readonly<Props>) {
  const t = useTranslations("AdminUsers");
  const locale = useLocale();

  const { data, isLoading } = trpc.adminUser.getDetail.useQuery({ id: userId }, { enabled: open });

  return (
    <Sheet
      onOpenChange={onOpenChange}
      open={open}
    >
      <SheetContent
        className="flex flex-col gap-6 p-6"
        resizable={{
          defaultWidth: 560,
          maxWidth: 900,
          minWidth: 380,
          storageKey: "sheet-admin-user-width",
        }}
      >
        <SheetHeader className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <SheetTitle className="font-semibold text-xl tracking-tight">
              {data ? (data.name ?? data.id) : t("detail_loading")}
            </SheetTitle>
            <SheetDescription className="text-muted-foreground text-xs">
              {data?.email ?? ""}
            </SheetDescription>
          </div>
        </SheetHeader>

        {isLoading || data == null ? (
          <div className="flex flex-col gap-4">
            <Skeleton className="h-6 w-1/3" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : (
          <AdminUserDetailBody
            actions={actions}
            data={data}
            locale={locale}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

type BodyProps = {
  actions: AdminUserActions;
  data: AdminUserDetail;
  locale: string;
};

function AdminUserDetailBody({ actions, data, locale }: Readonly<BodyProps>) {
  const t = useTranslations("AdminUsers");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-2">
        <AppBadge variant={data.role === UserRole.ADMIN ? "default" : "secondary"}>
          {data.role === UserRole.ADMIN ? t("role_admin") : t("role_user")}
        </AppBadge>
        <AppBadge variant={data.banned ? "destructive" : "outline"}>
          {data.banned ? t("banned_badge") : t("status_active")}
        </AppBadge>
        {data.twoFactorEnabled && <AppBadge variant="outline">{t("detail_2fa_on")}</AppBadge>}
      </div>

      {data.banned && (
        <div className="flex flex-col gap-1 rounded-xl border border-border bg-muted/5 p-4 text-sm">
          <span className="font-medium">{t("detail_ban_reason")}</span>
          <span className="text-muted-foreground">{data.banReason ?? t("detail_no_reason")}</span>
          {data.banExpires != null && (
            <span className="text-muted-foreground text-xs">
              {t("ban_until", { date: formatFullDate(data.banExpires, locale) })}
            </span>
          )}
        </div>
      )}

      <dl className="grid grid-cols-2 gap-4 text-sm">
        <MetaRow
          label={t("detail_email_verified")}
          value={data.emailVerified ? t("detail_yes") : t("detail_no")}
        />
        <MetaRow
          label={t("detail_last_login")}
          value={data.lastLoginMethod ?? t("detail_never")}
        />
        <MetaRow
          label={t("detail_created")}
          value={formatFullDate(data.createdAt, locale)}
        />
        <MetaRow
          label={t("detail_updated")}
          value={formatFullDate(data.updatedAt, locale)}
        />
      </dl>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <CountTile
          count={data.counts.repos}
          label={t("detail_count_repos")}
          name="repos"
        />
        <CountTile
          count={data.counts.sessions}
          label={t("detail_count_sessions")}
          name="sessions"
        />
        <CountTile
          count={data.counts.apiKeys}
          label={t("detail_count_api_keys")}
          name="apiKeys"
        />
        <CountTile
          count={data.counts.chatSessions}
          label={t("detail_count_chats")}
          name="chatSessions"
        />
        <CountTile
          count={data.counts.notifications}
          label={t("detail_count_notifications")}
          name="notifications"
        />
      </div>

      <AdminUserSessions
        actions={actions}
        userId={data.id}
      />
    </div>
  );
}

type CountTileProps = {
  count: number;
  label: string;
  name: string;
};

function CountTile({ count, label, name }: Readonly<CountTileProps>) {
  return (
    <div
      className="flex flex-col gap-1 rounded-xl border border-border p-4"
      data-testid={`count-${name}`}
    >
      <span className="font-semibold text-2xl">{count}</span>
      <span className="text-muted-foreground text-xs">{label}</span>
    </div>
  );
}

type MetaRowProps = {
  label: string;
  value: string;
};

function MetaRow({ label, value }: Readonly<MetaRowProps>) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="truncate">{value}</dd>
    </div>
  );
}
