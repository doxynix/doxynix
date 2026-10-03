"use client";

import { useState } from "react";
import { CheckCheck, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useQueryStates } from "nuqs";

import { useDebounce } from "@/shared/lib/hooks/use-debounce";
import { AppButton } from "@/shared/ui/core/button";
import { DangerActionDialog } from "@/shared/ui/kit/danger-action-dialog";
import { LoadingButton } from "@/shared/ui/kit/loading-button";

import { notificationsParsers } from "@/entities/notification/model/notifications-parsers";

import { useNotificationActions } from "../model/use-notification-actions";

type Props = {
  stats?: { read: number; unread: number };
};

export function NotificationsBulkActions({ stats }: Readonly<Props>) {
  const [filters] = useQueryStates(notificationsParsers);
  const { deleteRead, markAllAsRead } = useNotificationActions();
  const [open, setOpen] = useState(false);
  const t = useTranslations("Notifications");

  const debouncedSearch = useDebounce(filters.search, 500);

  const isMarkAllDisabled = !stats || stats.unread === 0 || markAllAsRead.isPending;
  const isDeleteReadDisabled = !stats || stats.read === 0 || deleteRead.isPending;

  const handleDelete = () => {
    deleteRead.mutate(
      { ...filters, search: debouncedSearch },
      {
        onSuccess: () => setOpen(false),
      },
    );
  };

  return (
    <div className="ml-auto flex items-center gap-2">
      <LoadingButton
        className="flex"
        disabled={isMarkAllDisabled}
        isLoading={markAllAsRead.isPending}
        onClick={() => markAllAsRead.mutate({ ...filters, search: debouncedSearch })}
        variant="outline"
      >
        <CheckCheck /> {t("mark_all_as_read")}
      </LoadingButton>
      <DangerActionDialog
        confirmLabel={t("yes_delete")}
        description={t("delete_all_read_description", { count: stats?.read ?? 0 })}
        isLoading={deleteRead.isPending}
        onConfirm={handleDelete}
        onOpenChange={setOpen}
        open={open}
        title={t("delete_all_read_confirm")}
        trigger={
          <AppButton
            className="flex"
            disabled={isDeleteReadDisabled}
            variant="destructive"
          >
            <Trash2 /> {t("delete_all_read")}
          </AppButton>
        }
      />
    </div>
  );
}
