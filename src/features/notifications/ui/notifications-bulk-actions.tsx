"use client";

import { useState } from "react";
import { AlertTriangle, CheckCheck, Trash2 } from "lucide-react";
import { useQueryStates } from "nuqs";
import { useDebounce } from "use-debounce";

import { Button } from "@/shared/ui/core/button";
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

import { notificationsParsers } from "@/entities/notifications";

import { useNotificationActions } from "../model/use-notification-actions";

type Props = {
  stats?: { read: number; unread: number };
};

export function NotificationsBulkActions({ stats }: Readonly<Props>) {
  const [filters] = useQueryStates(notificationsParsers, { shallow: true });
  const { deleteRead, markAllAsRead } = useNotificationActions();
  const [open, setOpen] = useState(false);

  const [debouncedSearch] = useDebounce(filters.search, 500);

  const isMarkAllDisabled = !stats || stats.unread === 0 || markAllAsRead.isPending;
  const isDeleteReadDisabled = !stats || stats.read === 0 || deleteRead.isPending;

  const handleDelete = () => {
    deleteRead.mutate(
      { ...filters, search: debouncedSearch },
      {
        onSuccess: () => setOpen(false),
      }
    );
  };

  return (
    <div className="ml-auto flex items-center gap-2">
      <LoadingButton
        disabled={isMarkAllDisabled}
        isLoading={markAllAsRead.isPending}
        loadingText="Processing..."
        variant="outline"
        onClick={() => markAllAsRead.mutate({ ...filters, search: debouncedSearch })}
        className="flex cursor-pointer"
      >
        <CheckCheck className="size-4" /> Mark all as read
      </LoadingButton>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button
            disabled={isDeleteReadDisabled}
            variant="destructive"
            className="flex cursor-pointer"
          >
            <Trash2 className="size-4" /> Delete all read
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader className="gap-2 sm:gap-0">
            <div className="flex items-center gap-4">
              <div className="bg-destructive/15 flex size-10 shrink-0 items-center justify-center rounded-full">
                <AlertTriangle className="text-destructive size-5" />
              </div>
              <div className="flex flex-col gap-1 overflow-hidden">
                <DialogTitle>Delete all read notifications?</DialogTitle>
                <DialogDescription>
                  This action will delete {stats?.read} notifications matching current filters.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" className="cursor-pointer">
                Cancel
              </Button>
            </DialogClose>
            <LoadingButton
              isLoading={deleteRead.isPending}
              loadingText="Deleting..."
              variant="destructive"
              onClick={handleDelete}
              className="cursor-pointer"
            >
              Yes, delete
            </LoadingButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
