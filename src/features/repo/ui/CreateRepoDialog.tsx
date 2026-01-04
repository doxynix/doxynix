"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { trpc } from "@/shared/api/trpc";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPortal,
  DialogTitle,
} from "@/shared/ui/dialog";
import GitHubIcon from "@/shared/ui/github-icon";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { LoadingButton } from "@/shared/ui/LoadingButton";
import { useCreateRepoDialogStore } from "@/features/repo/model/create-repo-dialog.store";

export function CreateRepoDialog() {
  const { open, closeDialog } = useCreateRepoDialogStore();
  const [url, setUrl] = useState("");
  const router = useRouter();

  const createRepo = trpc.repo.create.useMutation({
    onSuccess: () => {
      toast.success("Репозиторий успешно добавлен!");
      closeDialog();
      setUrl("");

      router.refresh();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;

    createRepo.mutate({ url });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && closeDialog()}>
      <DialogPortal>
        <DialogContent className="sm:max-w-106.25">
          <DialogHeader>
            <DialogTitle>Добавление репозитория</DialogTitle>
            <DialogDescription>
              Введите url репозитория или его имя для добавления
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="grid gap-4 py-4">
            <div className="flex flex-col gap-3">
              <Label>Ссылка на репозиторий или его имя</Label>
              <div className="relative">
                <GitHubIcon className="absolute top-2.5 left-2.5" />
                <Input
                  id="repo-url"
                  className="pl-8"
                  placeholder="owner/repo или https://github.com/..."
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  disabled={createRepo.isPending}
                />
              </div>
            </div>
            <DialogFooter>
              <LoadingButton
                className="cursor-pointer"
                isLoading={createRepo.isPending}
                loadingText="Добавление..."
                disabled={createRepo.isPending || !url}
              >
                Добавить
              </LoadingButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}
