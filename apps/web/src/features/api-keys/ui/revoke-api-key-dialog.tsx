"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { AppButton } from "@/shared/ui/core/button";
import { AppTooltip } from "@/shared/ui/kit/app-tooltip";
import { DangerActionDialog } from "@/shared/ui/kit/danger-action-dialog";

import type { UiApiKey } from "@/entities/api-keys/model/api-keys.types";

import { useApiKeyActions } from "../model/use-api-key-actions";

type Props = {
  apiKey: UiApiKey;
};

export function RevokeApiKeyDialog({ apiKey }: Readonly<Props>) {
  const [open, setOpen] = useState(false);
  const { revoke } = useApiKeyActions();

  const t = useTranslations("Dashboard");

  const handleRevoke = () => {
    revoke.mutate(
      { id: apiKey.id },
      {
        onSuccess: () => setOpen(false),
      },
    );
  };

  return (
    <DangerActionDialog
      confirmLabel={t("settings_api_keys_confirm_revoke")}
      description={t("settings_api_keys_revoke_key_desc")}
      destructiveAlertContent={t("settings_api_keys_revoke_note")}
      isLoading={revoke.isPending}
      onConfirm={handleRevoke}
      onOpenChange={setOpen}
      open={open}
      title={`${t("settings_api_keys_revoke_key")}?`}
      trigger={
        <AppTooltip content={t("settings_api_keys_revoke_key")}>
          <AppButton
            aria-label="Revoke key"
            className="text-destructive not-md:opacity-100 opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
            onClick={(e) => {
              e.preventDefault();
              setOpen(true);
            }}
            size="icon"
            variant="ghost"
          >
            <Trash2 />
          </AppButton>
        </AppTooltip>
      }
    >
      <div className="truncate pb-2 font-bold text-foreground">{apiKey.name}</div>
    </DangerActionDialog>
  );
}
