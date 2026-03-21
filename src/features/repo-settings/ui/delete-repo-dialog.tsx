"use client";

import { useState } from "react";
import { AlertTriangle, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";

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

import { useRepoActions } from "@/entities/repo";

type Props = { id: string };

export function DeleteRepoDialog({ id }: Readonly<Props>) {
  const [open, setOpen] = useState(false);
  const tCommon = useTranslations("Common");
  const t = useTranslations("Dashboard");
  const { deleteRepo } = useRepoActions();

  const handleDelete = () => {
    deleteRepo.mutate(
      { id },
      {
        onSuccess: () => setOpen(false),
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive" className="w-fit cursor-pointer">
          Delete repository <Trash2 className="size-4" />
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader className="gap-2 sm:gap-0">
          <div className="flex items-center gap-4">
            <div className="bg-destructive/15 flex size-10 shrink-0 items-center justify-center rounded-full">
              <AlertTriangle className="text-destructive size-5" />
            </div>
            <div className="flex flex-col gap-1 overflow-hidden">
              <DialogTitle>Delete repository?</DialogTitle>
              <DialogDescription>You are about to delete repository!</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Alert variant="success" className="border-success/10 text-success bg-success/5">
          <AlertTitle className="text-base font-bold">
            {t("settings_danger_alert_title")}
          </AlertTitle>
          <AlertDescription>
            <span>
              This action <strong>will not delete</strong> your GitHub/GitLab repositories. They
              will simply stop appearing in this service.
            </span>
          </AlertDescription>
        </Alert>

        <Alert
          variant="destructive"
          className="border-destructive/10 bg-destructive/5 text-destructive"
        >
          <AlertTitle className="text-base font-bold">
            <span>{tCommon("warning")}</span>
          </AlertTitle>
          <AlertDescription>
            <span>
              This action is <strong>irreversible</strong>. Deleting repository entails the complete
              removal of all generated documentation and calculated metrics.
            </span>
          </AlertDescription>
        </Alert>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" className="cursor-pointer">
              {tCommon("cancel")}
            </Button>
          </DialogClose>
          <LoadingButton
            isLoading={deleteRepo.isPending}
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
