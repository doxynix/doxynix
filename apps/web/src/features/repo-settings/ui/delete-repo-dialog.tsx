"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { useRouter } from "@/shared/i18n/routing";
import { AppButton } from "@/shared/ui/core/button";
import { DangerActionDialog } from "@/shared/ui/kit/danger-action-dialog";

import { useRepoActions } from "@/entities/repo/model/use-repo-actions";

type Props = { id: string };

export function DeleteRepoDialog({ id }: Readonly<Props>) {
  const [open, setOpen] = useState(false);
  const t = useTranslations("Dashboard");
  const { deleteRepo } = useRepoActions();
  const router = useRouter();

  const handleDelete = () => {
    deleteRepo.mutate(
      { id },
      {
        onSuccess: () => {
          setOpen(false);
          router.push(`/dashboard/repos`);
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
        <AppButton variant="destructive" className="w-fit cursor-pointer">
          Delete repository <Trash2 />
        </AppButton>
      }
      onConfirm={handleDelete}
      onOpenChange={setOpen}
    />
  );
}
