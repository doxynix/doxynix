"use client";

import { useState } from "react";
import { AlertTriangle, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";

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
import { AppTooltip } from "@/shared/ui/kit/app-tooltip";
import { LoadingButton } from "@/shared/ui/kit/loading-button";

import type { UiApiKey } from "@/entities/api-keys";
import { useApiKeyActions } from "../model/use-api-key-actions";

type Props = {
  apiKey: UiApiKey;
};

export function RevokeApiKeyDialog({ apiKey }: Readonly<Props>) {
  const [open, setOpen] = useState(false);
  const { revoke } = useApiKeyActions();

  const tCommon = useTranslations("Common");
  const t = useTranslations("Dashboard");

  const handleRevoke = () => {
    revoke.mutate(
      { id: apiKey.id },
      {
        onSuccess: () => setOpen(false),
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <AppTooltip content={t("settings_api_keys_revoke_key")}>
        <DialogTrigger asChild>
          <Button
            size="icon"
            variant="ghost"
            className="text-destructive hover:text-destructive hover:bg-destructive/10 opacity-0 transition-opacity not-md:opacity-100 group-hover:opacity-100"
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
              <DialogTitle>{t("settings_api_keys_revoke_key")}?</DialogTitle>
              <DialogDescription className="flex max-w-75 flex-col gap-1">
                <span>{t("settings_api_keys_revoke_key_desc")}</span>
                <span className="text-foreground truncate font-bold">{apiKey.name}</span>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <p className="text-muted-foreground text-sm">{t("settings_api_keys_revoke_note")}</p>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" className="cursor-pointer">
              {tCommon("cancel")}
            </Button>
          </DialogClose>
          <LoadingButton
            isLoading={revoke.isPending}
            loadingText="Revoking..."
            variant="destructive"
            onClick={handleRevoke}
            className="cursor-pointer"
          >
            {t("settings_api_keys_confirm_revoke")}
          </LoadingButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
