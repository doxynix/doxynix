"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { Button } from "@/shared/ui/core/button";
import { DangerActionDialog } from "@/shared/ui/kit/danger-action-dialog";
import { redirect } from "@/i18n/routing";

import { useRepoActions } from "@/entities/repo";

type Props = { id: string };

export function DeleteRepoDialog({ id }: Readonly<Props>) {
  const [open, setOpen] = useState(false);
  const t = useTranslations("Dashboard");
  const { deleteRepo } = useRepoActions();
  const locale = useLocale();

  const handleDelete = () => {
    deleteRepo.mutate(
      { id },
      {
        onSuccess: () => {
          setOpen(false);
          redirect({ href: "/dashboard/repos", locale });
        },
      }
    );
  };

  return (
    <DangerActionDialog
      confirmLabel={t("settings_danger_delete_confirmation")}
      description="You are about to delete repository!"
      destructiveAlertContent={
        <span>
          This action is <strong>irreversible</strong>. Deleting repository entails the complete
          removal of all generated documentation and calculated metrics.
        </span>
      }
      isLoading={deleteRepo.isPending}
      open={open}
      successAlertContent={
        <span>
          This action <strong>will not delete</strong> your GitHub/GitLab repositories. They will
          simply stop appearing in this service.
        </span>
      }
      successAlertTitle={t("settings_danger_alert_title")}
      title="Delete repository?"
      trigger={
        <Button variant="destructive" className="w-fit cursor-pointer">
          Delete repository <Trash2 className="size-4" />
        </Button>
      }
      onConfirm={handleDelete}
      onOpenChange={setOpen}
    />
  );
}
