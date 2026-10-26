"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { AppButton } from "@/shared/ui/core/button";
import { AppTooltip } from "@/shared/ui/kit/app-tooltip";
import { DangerActionDialog } from "@/shared/ui/kit/danger-action-dialog";

import type { AgentSession } from "../model/agent-types";
import { useAgentSessionActions } from "../model/use-agent-session-actions";

type Props = {
  onDeleted?: (sessionId: string) => void;
  session: AgentSession;
};

export function DeleteChatDialog({ onDeleted, session }: Readonly<Props>) {
  const [open, setOpen] = useState(false);
  const { remove } = useAgentSessionActions();

  const t = useTranslations("Agent");

  const handleDelete = () => {
    remove.mutate(
      { sessionId: session.id },
      {
        onSuccess: () => {
          setOpen(false);
          onDeleted?.(session.id);
        },
      },
    );
  };

  return (
    <DangerActionDialog
      confirmLabel={t("delete_chat_confirm")}
      description={t("delete_chat_description")}
      destructiveAlertContent={t("delete_chat_warning")}
      isLoading={remove.isPending}
      onConfirm={handleDelete}
      onOpenChange={setOpen}
      open={open}
      title={t("delete_chat_title")}
      trigger={
        <AppTooltip content={t("delete_chat")}>
          <AppButton
            aria-label={t("delete_chat")}
            className="size-6 text-destructive"
            onClick={(e) => {
              e.preventDefault();
              setOpen(true);
            }}
            size="icon"
            type="button"
            variant="ghost"
          >
            <Trash2 />
          </AppButton>
        </AppTooltip>
      }
    >
      <div className="truncate pb-2 font-bold text-foreground">{session.title}</div>
    </DangerActionDialog>
  );
}
