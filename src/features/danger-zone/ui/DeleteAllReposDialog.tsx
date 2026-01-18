"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { trpc } from "@/shared/api/trpc";
import { Alert, AlertDescription, AlertTitle } from "@/shared/ui/alert";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/ui/dialog";
import { LoadingButton } from "@/shared/ui/LoadingButton";

import { RepoMeta } from "@/entities/repo/model/types";

export function DeleteAllReposDialog({ meta }: { meta: RepoMeta }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const utils = trpc.useUtils();
  const hasRepos = (meta?.totalCount ?? 0) > 0;

  const deleteMutation = trpc.repo.deleteAll.useMutation({
    onSuccess: async () => {
      toast.success("Все репозитории были удалены");
      setOpen(false);
      router.refresh();
      await utils.repo.getAll.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const handleDelete = () => {
    deleteMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive" disabled={!hasRepos} className="w-fit cursor-pointer">
          Удалить все репозитории <Trash2 className="h-4 w-4" />
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader className="gap-2 sm:gap-0">
          <div className="flex items-center gap-4">
            <div className="bg-destructive/15 flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
              <AlertTriangle className="text-destructive h-5 w-5" />
            </div>
            <div className="flex flex-col gap-1 overflow-hidden">
              <DialogTitle>Удалить все репозитории?</DialogTitle>
              <DialogDescription>Вы собираетесь удалить все репозитории!</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Alert variant="success" className="border-success/10 text-success bg-success/5">
          <AlertTitle className="text-[16px] font-bold">Безопасно для исходного кода</AlertTitle>
          <AlertDescription>
            <span>
              Это действие <strong>не удалит</strong> ваши репозитории на GitHub/GitLab. Они просто
              перестанут перестанут отображаться в этом сервисе.
            </span>
          </AlertDescription>
        </Alert>

        <Alert
          variant="destructive"
          className="border-destructive/10 bg-destructive/5 text-destructive"
        >
          <AlertTitle className="text-[16px] font-bold">Внимание</AlertTitle>
          <AlertDescription>
            <span>
              Это действие <strong>необратимо</strong>. Удаление всех репозиториев влечет за собой
              полное полное удаление удаление всех сгенерированных документаций, а также рассч
              итанных метрик.
            </span>
          </AlertDescription>
        </Alert>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" className="cursor-pointer">
              Отмена
            </Button>
          </DialogClose>
          <LoadingButton
            variant="destructive"
            className="cursor-pointer"
            onClick={handleDelete}
            isLoading={deleteMutation.isPending}
            loadingText="Удаление..."
          >
            Да, удалить
          </LoadingButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
