"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { trpc } from "@/shared/api/trpc";
import { AppTooltip } from "@/shared/ui/AppTooltip";
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

import { UiApiKey } from "@/entities/api-keys";

type Props = {
  apiKey: UiApiKey;
};

export function RevokeApiKeyDialog({ apiKey }: Props) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const revokeMutation = trpc.apikey.revoke.useMutation({
    onSuccess: async () => {
      toast.success("Ключ успешно отозван");
      setOpen(false);
      router.refresh();
    },
    onError: (err) => toast.error(err.message),
  });

  const handleRevoke = () => {
    revokeMutation.mutate({ id: apiKey.id });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <AppTooltip content="Отозвать ключ">
        <DialogTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="text-destructive hover:text-destructive hover:bg-destructive/10 opacity-0 transition-opacity group-hover:opacity-100"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </DialogTrigger>
      </AppTooltip>

      <DialogContent className="sm:max-w-md">
        <DialogHeader className="gap-2 sm:gap-0">
          <div className="flex items-center gap-4">
            <div className="bg-destructive/15 flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
              <AlertTriangle className="text-destructive h-5 w-5" />
            </div>
            <div className="flex flex-col gap-1 overflow-hidden">
              <DialogTitle>Отозвать ключ?</DialogTitle>
              <DialogDescription className="truncate">
                Вы собираетесь удалить ключ <b>{apiKey.name}</b>.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="text-muted-foreground text-sm">
          Это действие необратимо. Любые приложения, использующие этот ключ, перестанут работать
          немедленно.
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" className="cursor-pointer">
              Отмена
            </Button>
          </DialogClose>
          <LoadingButton
            variant="destructive"
            className="cursor-pointer"
            onClick={handleRevoke}
            isLoading={revokeMutation.isPending}
            loadingText="Удаление..."
          >
            Да, отозвать
          </LoadingButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
