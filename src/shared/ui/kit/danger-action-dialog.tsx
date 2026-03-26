"use client";

import { AlertTriangle } from "lucide-react";
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

type Props = {
  children?: React.ReactNode;
  confirmLabel: string;
  description: string;
  destructiveAlertContent: React.ReactNode;
  isLoading: boolean;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  successAlertContent?: React.ReactNode;
  successAlertTitle?: string;
  title: string;
  trigger: React.ReactNode;
};

export function DangerActionDialog({
  children,
  confirmLabel,
  description,
  destructiveAlertContent,
  isLoading,
  onConfirm,
  onOpenChange,
  open,
  successAlertContent,
  successAlertTitle,
  title,
  trigger,
}: Readonly<Props>) {
  const tCommon = useTranslations("Common");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader className="gap-2 sm:gap-0">
          <div className="flex items-center gap-4">
            <div className="bg-destructive/15 flex size-10 shrink-0 items-center justify-center rounded-full">
              <AlertTriangle className="text-destructive size-5" />
            </div>
            <div className="flex flex-col gap-1 overflow-hidden">
              <DialogTitle>{title}</DialogTitle>
              <DialogDescription>{description}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {children}

        {successAlertTitle && successAlertContent && (
          <Alert variant="success" className="border-success/10 text-success bg-success/5">
            <AlertTitle className="text-base font-bold">{successAlertTitle}</AlertTitle>
            <AlertDescription>{successAlertContent}</AlertDescription>
          </Alert>
        )}

        <Alert
          variant="destructive"
          className="border-destructive/10 bg-destructive/5 text-destructive"
        >
          <AlertTitle className="text-base font-bold">
            <span>{tCommon("warning")}</span>
          </AlertTitle>
          <AlertDescription>{destructiveAlertContent}</AlertDescription>
        </Alert>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" className="cursor-pointer">
              {tCommon("cancel")}
            </Button>
          </DialogClose>
          <LoadingButton
            isLoading={isLoading}
            loadingText="Deleting..."
            variant="destructive"
            onClick={onConfirm}
            className="cursor-pointer"
          >
            {confirmLabel}
          </LoadingButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
