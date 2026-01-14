"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Trash2 } from "lucide-react";
import { signOut } from "next-auth/react";
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

export function DeleteAccountDialog() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const deleteMutation = trpc.user.deleteAccount.useMutation({
    onSuccess: async () => {
      toast.success("Аккаунт успешно удален");
      setOpen(false);
      router.refresh();
      await signOut({ callbackUrl: "/auth" });
    },
    onError: (err) => toast.error(err.message),
  });

  const handleDelete = () => {
    deleteMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive" className="w-fit cursor-pointer">
          Удалить аккаунт <Trash2 className="h-4 w-4" />
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader className="gap-2 sm:gap-0">
          <div className="flex items-center gap-4">
            <div className="bg-destructive/15 flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
              <AlertTriangle className="text-destructive h-5 w-5" />
            </div>
            <div className="flex flex-col gap-1 overflow-hidden">
              <DialogTitle>Удалить аккаунт?</DialogTitle>
              <DialogDescription>Вы собираетесь удалить аккаунт!</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="text-muted-foreground text-sm"></div>
        <Alert
          variant="destructive"
          className="border-destructive/10 bg-destructive/5 text-destructive"
        >
          <AlertTitle className="text-[16px] font-bold">Внимание</AlertTitle>
          <AlertDescription>
            Это действие необратимо. Удаление аккаунта влечет за собой полное удаление сохраненных
            учетных данных. Также произойдет мгновенный выход из аккаунта со всех устройств
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
