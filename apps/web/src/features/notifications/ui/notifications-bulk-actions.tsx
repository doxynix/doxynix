"use client";

import { useState } from "react";
import { AlertTriangle, CheckCheck, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useQueryStates } from "nuqs";

import { useDebounce } from "@/shared/lib/hooks/use-debounce";
import { AppButton } from "@/shared/ui/core/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/ui/core/dialog";
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
  const tCommon = useTranslations("Common");

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
        className="flex cursor-pointer"
        disabled={isMarkAllDisabled}
        isLoading={markAllAsRead.isPending}
        loadingText={tCommon("processing")}
        onClick={() => markAllAsRead.mutate({ ...filters, search: debouncedSearch })}
        variant="outline"
      >
        <CheckCheck /> {t("mark_all_as_read")}
      </LoadingButton>
      <Dialog
        onOpenChange={setOpen}
        open={open}
      >
        <DialogTrigger asChild>
          <AppButton
            className="flex cursor-pointer"
            disabled={isDeleteReadDisabled}
            variant="destructive"
          >
            <Trash2 /> {t("delete_all_read")}
          </AppButton>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader className="gap-2 sm:gap-0">
            <div className="flex items-center gap-4">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-destructive/15">
                <AlertTriangle className="size-5 text-destructive" />
              </div>
              <div className="flex flex-col gap-1 overflow-hidden">
                <DialogTitle>{t("delete_all_read_confirm")}</DialogTitle>
                <DialogDescription>
                  {t("delete_all_read_description", { count: stats?.read ?? 0 })}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <AppButton
                className="cursor-pointer"
                variant="outline"
              >
                {tCommon("cancel")}
              </AppButton>
            </DialogClose>
            <LoadingButton
              className="cursor-pointer"
              isLoading={deleteRead.isPending}
              loadingText={t("deleting")}
              onClick={handleDelete}
              variant="destructive"
            >
              {t("yes_delete")}
            </LoadingButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
