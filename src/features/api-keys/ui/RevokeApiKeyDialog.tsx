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
      toast.success("API Key revoked");
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
      <AppTooltip content="Revoke Key">
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
              <DialogTitle>Revoke Key?</DialogTitle>
              <DialogDescription className="flex max-w-75 flex-col gap-1">
                <span>You are about to revoke key</span>
                <span className="text-foreground truncate font-bold">{apiKey.name}</span>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="text-muted-foreground text-sm">
          This action cannot be undone. Any applications using this key will stop working
          immediately.
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" className="cursor-pointer">
              Cancel
            </Button>
          </DialogClose>
          <LoadingButton
            variant="destructive"
            className="cursor-pointer"
            onClick={handleRevoke}
            isLoading={revokeMutation.isPending}
            loadingText="Revoking..."
          >
            Yes, revoke
          </LoadingButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
