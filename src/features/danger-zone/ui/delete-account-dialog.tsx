"use client";

import { useState } from "react";
import { AlertTriangle, Trash2 } from "lucide-react";
import { signOut } from "next-auth/react";
import { useTranslations } from "next-intl";
import posthog from "posthog-js";
import { toast } from "sonner";

import { trpc } from "@/shared/api/trpc";
import { Alert, AlertDescription, AlertTitle } from "@/shared/ui/core/alert";
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

export function DeleteAccountDialog() {
  const [open, setOpen] = useState(false);
  const tCommon = useTranslations("Common");
  const t = useTranslations("Dashboard");

  const deleteMutation = trpc.user.deleteAccount.useMutation({
    onError: (err) => toast.error(err.message),
    onSuccess: async () => {
      toast.success(t("settings_danger_delete_account_toast_success"));
      setOpen(false);
      posthog.capture("account_deleted");
      await signOut({ callbackUrl: "/auth" });
    },
  });

  const handleDelete = () => {
    deleteMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive" className="w-fit cursor-pointer">
          {t("settings_danger_delete_account_title")} <Trash2 className="h-4 w-4" />
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader className="gap-2 sm:gap-0">
          <div className="flex items-center gap-4">
            <div className="bg-destructive/15 flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
              <AlertTriangle className="text-destructive h-5 w-5" />
            </div>
            <div className="flex flex-col gap-1 overflow-hidden">
              <DialogTitle>{t("settings_danger_delete_account_dialog_title")}</DialogTitle>
              <DialogDescription>
                {t("settings_danger_delete_account_dialog_desc")}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="text-muted-foreground text-sm"></div>
        <Alert
          variant="destructive"
          className="border-destructive/10 bg-destructive/5 text-destructive"
        >
          <AlertTitle className="text-base font-bold">{tCommon("warning")}</AlertTitle>
          <AlertDescription>{t("settings_danger_delete_account_alert_desc")}</AlertDescription>
        </Alert>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" className="cursor-pointer">
              {tCommon("cancel")}
            </Button>
          </DialogClose>
          <LoadingButton
            isLoading={deleteMutation.isPending}
            loadingText="Deleting..."
            variant="destructive"
            onClick={handleDelete}
            className="cursor-pointer"
          >
            {t("settings_danger_delete_confirmation")}
          </LoadingButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
