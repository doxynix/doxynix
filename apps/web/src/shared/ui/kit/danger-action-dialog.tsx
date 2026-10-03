"use client";

import { type ReactNode, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { useTranslations } from "next-intl";

import { Alert, AlertDescription, AlertTitle } from "@/shared/ui/core/alert";
import { AppButton } from "@/shared/ui/core/button";
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

import { ConfirmationField, phraseMatches } from "./confirmation-field";

type Props = {
  children?: ReactNode;
  confirmLabel: string;
  confirmationPhrase?: string;
  description: string;
  destructiveAlertContent?: ReactNode;
  isLoading: boolean;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  successAlertContent?: ReactNode;
  successAlertTitle?: string;
  title: string;
  trigger?: ReactNode;
};

export function DangerActionDialog({
  children,
  confirmLabel,
  confirmationPhrase,
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
  const [phraseInput, setPhraseInput] = useState("");
  const isConfirmed = confirmationPhrase == null || phraseMatches(phraseInput, confirmationPhrase);

  // Radix unmounts the content on close, but `phraseInput` lives here, so it needs clearing
  // explicitly or reopening the dialog would leave the confirm button armed.
  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (!open) {
      setPhraseInput("");
    }
  }

  return (
    <Dialog
      onOpenChange={onOpenChange}
      open={open}
    >
      {trigger != null && <DialogTrigger asChild>{trigger}</DialogTrigger>}

      <DialogContent className="sm:max-w-md">
        <DialogHeader className="gap-2 sm:gap-0">
          <div className="flex items-center gap-4">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-destructive/15">
              <AlertTriangle className="size-5 text-destructive" />
            </div>
            <div className="flex flex-col gap-1 overflow-hidden">
              <DialogTitle>{title}</DialogTitle>
              <DialogDescription>{description}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {children}

        {confirmationPhrase != null && (
          <ConfirmationField
            onValueChange={setPhraseInput}
            phrase={confirmationPhrase}
            value={phraseInput}
          />
        )}

        {successAlertTitle && successAlertContent && (
          <Alert
            className="border-success/10 bg-success/5 text-success"
            variant="success"
          >
            <AlertTitle className="font-bold text-base">{successAlertTitle}</AlertTitle>
            <AlertDescription>{successAlertContent}</AlertDescription>
          </Alert>
        )}

        {destructiveAlertContent != null && (
          <Alert
            className="border-destructive/10 bg-destructive/5 text-destructive"
            variant="destructive"
          >
            <AlertTitle className="font-bold text-base">
              <span>{tCommon("warning")}</span>
            </AlertTitle>
            <AlertDescription>{destructiveAlertContent}</AlertDescription>
          </Alert>
        )}

        <DialogFooter>
          <DialogClose asChild>
            <AppButton variant="outline">{tCommon("cancel")}</AppButton>
          </DialogClose>
          <LoadingButton
            disabled={!isConfirmed}
            isLoading={isLoading}
            onClick={onConfirm}
            variant="destructive"
          >
            {confirmLabel}
          </LoadingButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
