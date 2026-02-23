"use client";

import { useState } from "react";
import { AlertTriangle, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";

import type { RepoMeta } from "@/shared/types/repo";
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

const richStyles = {
  strong: (chunks: React.ReactNode) => <strong>{chunks}</strong>,
};

export function DeleteAllReposDialog({ meta }: Readonly<{ meta: RepoMeta }>) {
  const [open, setOpen] = useState(false);
  const hasRepos = (meta?.totalCount ?? 0) > 0;
  const tCommon = useTranslations("Common");
  const t = useTranslations("Dashboard");
  const tsRich = (key: string) => t.rich(key, richStyles);
  const { deleteAll } = useRepoActions();

  const handleDelete = () => {
    deleteAll.mutate(undefined, {
      onSuccess: () => setOpen(false),
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button disabled={!hasRepos} variant="destructive" className="w-fit cursor-pointer">
          {t("settings_danger_delete_all_repos")} <Trash2 className="h-4 w-4" />
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader className="gap-2 sm:gap-0">
          <div className="flex items-center gap-4">
            <div className="bg-destructive/15 flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
              <AlertTriangle className="text-destructive h-5 w-5" />
            </div>
            <div className="flex flex-col gap-1 overflow-hidden">
              <DialogTitle>{t("settings_danger_delete_all_repos")}?</DialogTitle>
              <DialogDescription>{t("settings_danger_delete_all_repos_desc")}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Alert variant="success" className="border-success/10 text-success bg-success/5">
          <AlertTitle className="text-base font-bold">
            {t("settings_danger_alert_title")}
          </AlertTitle>
          <AlertDescription>
            <span>{tsRich("settings_danger_delete_all_repos_note_3")}</span>
          </AlertDescription>
        </Alert>

        <Alert
          variant="destructive"
          className="border-destructive/10 bg-destructive/5 text-destructive"
        >
          <AlertTitle className="text-base font-bold">{tCommon("warning")}</AlertTitle>
          <AlertDescription>{tsRich("settings_danger_delete_all_repos_note_4")}</AlertDescription>
        </Alert>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" className="cursor-pointer">
              {tCommon("cancel")}
            </Button>
          </DialogClose>
          <LoadingButton
            isLoading={deleteAll.isPending}
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
