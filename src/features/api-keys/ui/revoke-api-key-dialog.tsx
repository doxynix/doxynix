"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/shared/ui/core/button";
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
      }
    );
  };

  return (
    <DangerActionDialog
      confirmLabel={t("settings_api_keys_confirm_revoke")}
      description={t("settings_api_keys_revoke_key_desc")}
      destructiveAlertContent={t("settings_api_keys_revoke_note")}
      isLoading={revoke.isPending}
      open={open}
      title={`${t("settings_api_keys_revoke_key")}?`}
      trigger={
        <AppTooltip content={t("settings_api_keys_revoke_key")}>
          <Button
            size="icon"
            variant="ghost"
            aria-label="Revoke key"
            onClick={(e) => {
              e.preventDefault();
              setOpen(true);
            }}
            className="text-destructive hover:text-destructive hover:bg-destructive/10 opacity-0 transition-opacity not-md:opacity-100 group-hover:opacity-100"
          >
            <Trash2 />
          </Button>
        </AppTooltip>
      }
      onConfirm={handleRevoke}
      onOpenChange={setOpen}
    >
      <div className="text-foreground truncate pb-2 font-bold">{apiKey.name}</div>
    </DangerActionDialog>
  );
}
