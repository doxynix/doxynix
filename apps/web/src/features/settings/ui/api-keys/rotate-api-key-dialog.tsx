"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";

import { Alert, AlertDescription, AlertTitle } from "@/shared/ui/core/alert";
import { AppButton } from "@/shared/ui/core/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/ui/core/dialog";
import { Input } from "@/shared/ui/core/input";
import { CopyButton } from "@/shared/ui/kit/copy-button";
import { LoadingButton } from "@/shared/ui/kit/loading-button";

import type { UiApiKey } from "@/entities/api-key/model/api-keys.types";

import { useApiKeyActions } from "../../model/api-keys/use-api-key-actions";

type Props = {
  apiKey: UiApiKey;
};

export function RotateApiKeyDialog({ apiKey }: Readonly<Props>) {
  const [open, setOpen] = useState(false);
  const [issuedKey, setIssuedKey] = useState<string | null>(null);
  const { rotate } = useApiKeyActions();

  const t = useTranslations("Dashboard");
  const tCommon = useTranslations("Common");

  const handleRotate = () => {
    rotate.mutate(
      { id: apiKey.id },
      {
        onSuccess: (data) => {
          setIssuedKey(data.key);
        },
      },
    );
  };

  const handleOpenChange = (value: boolean) => {
    setOpen(value);
    if (!value) {
      setTimeout(() => setIssuedKey(null), 300);
    }
  };

  return (
    <Dialog
      onOpenChange={handleOpenChange}
      open={open}
    >
      <DialogTrigger asChild>
        <AppButton
          aria-label={t("settings_api_keys_rotate_aria")}
          className="text-muted-foreground not-md:opacity-100 opacity-0 transition-opacity group-hover:opacity-100"
          onClick={(e) => {
            e.preventDefault();
            setOpen(true);
          }}
          size="icon"
          variant="ghost"
        >
          <RefreshCw />
        </AppButton>
      </DialogTrigger>

      <DialogContent
        onEscapeKeyDown={(e) => issuedKey != null && e.preventDefault()}
        onPointerDownOutside={(e) => issuedKey != null && e.preventDefault()}
      >
        {issuedKey == null ? (
          <>
            <DialogHeader>
              <DialogTitle>{t("settings_api_keys_rotate_key")}</DialogTitle>
              <DialogDescription>
                {t("settings_api_keys_rotate_key_desc")}{" "}
                <span className="font-bold text-foreground">{`${apiKey.prefix}...`}</span>
              </DialogDescription>
            </DialogHeader>

            <Alert className="border-warning/20 bg-warning/10 text-warning-foreground">
              <AlertTitle className="font-semibold">
                {t("settings_api_keys_rotate_note_title")}
              </AlertTitle>
              <AlertDescription>{t("settings_api_keys_rotate_note")}</AlertDescription>
            </Alert>

            <DialogFooter>
              <LoadingButton
                isLoading={rotate.isPending}
                onClick={handleRotate}
              >
                {t("settings_api_keys_rotate_key")}
              </LoadingButton>
            </DialogFooter>
          </>
        ) : (
          <div className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>{t("settings_api_keys_save_api_key")}</DialogTitle>
              <DialogDescription>{t("settings_api_keys_save_api_key_desc")}</DialogDescription>
            </DialogHeader>

            <div className="flex items-center gap-2">
              <div className="grid flex-1 gap-2">
                <Input
                  disabled={rotate.isPending}
                  readOnly
                  value={issuedKey}
                />
              </div>
              <CopyButton
                className="opacity-100"
                tooltipText={tCommon("copy")}
                value={issuedKey}
              />
            </div>

            <DialogFooter>
              <AppButton
                className="w-full"
                onClick={() => handleOpenChange(false)}
              >
                {tCommon("done")}
              </AppButton>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
