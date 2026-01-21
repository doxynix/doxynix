"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Trash2 } from "lucide-react";
import { signOut } from "next-auth/react";
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
  const router = useRouter();

  const deleteMutation = trpc.user.deleteAccount.useMutation({
    onSuccess: async () => {
      toast.success("Account successfully deleted");
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
          Delete account <Trash2 className="h-4 w-4" />
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader className="gap-2 sm:gap-0">
          <div className="flex items-center gap-4">
            <div className="bg-destructive/15 flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
              <AlertTriangle className="text-destructive h-5 w-5" />
            </div>
            <div className="flex flex-col gap-1 overflow-hidden">
              <DialogTitle>Delete account?</DialogTitle>
              <DialogDescription>You are about to delete your account!</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="text-muted-foreground text-sm"></div>
        <Alert
          variant="destructive"
          className="border-destructive/10 bg-destructive/5 text-destructive"
        >
          <AlertTitle className="text-base font-bold">Warning</AlertTitle>
          <AlertDescription>
            This action is irreversible. Deleting your account entails the complete removal of saved
            credentials. You will also be immediately logged out from all devices.
          </AlertDescription>
        </Alert>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" className="cursor-pointer">
              Cancel
            </Button>
          </DialogClose>
          <LoadingButton
            variant="destructive"
            className="cursor-pointer"
            onClick={handleDelete}
            isLoading={deleteMutation.isPending}
            loadingText="Deleting..."
          >
            Yes, delete
          </LoadingButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
