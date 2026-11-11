"use client";

import { type SubmitEvent, useEffect, useRef, useState } from "react";
import { Pencil } from "lucide-react";
import { useTranslations } from "next-intl";

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
import { AppTooltip } from "@/shared/ui/kit/app-tooltip";
import { LoadingButton } from "@/shared/ui/kit/loading-button";

import type { AgentSession } from "../model/agent-types";
import { useAgentSessionActions } from "../model/use-agent-session-actions";

type Props = {
  session: AgentSession;
};

export function RenameChatDialog({ session }: Readonly<Props>) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(session.title);
  const inputRef = useRef<HTMLInputElement>(null);
  const { update } = useAgentSessionActions();

  const t = useTranslations("Agent");
  const tCommon = useTranslations("Common");

  const trimmedTitle = title.trim();
  const isUnchanged = trimmedTitle === session.title;

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [open]);

  const handleOpenChange = (value: boolean) => {
    if (value) {
      setTitle(session.title);
    }
    setOpen(value);
  };

  const handleSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (trimmedTitle === "" || isUnchanged) {
      return;
    }

    update.mutate(
      { sessionId: session.id, title: trimmedTitle },
      { onSuccess: () => setOpen(false) },
    );
  };

  return (
    <Dialog
      onOpenChange={handleOpenChange}
      open={open}
    >
      <AppTooltip content={t("rename_chat")}>
        <DialogTrigger asChild>
          <AppButton
            aria-label={t("rename_chat")}
            className="size-6"
            size="icon"
            type="button"
            variant="ghost"
          >
            <Pencil />
          </AppButton>
        </DialogTrigger>
      </AppTooltip>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("rename_chat_title")}</DialogTitle>
          <DialogDescription>{t("rename_chat_description")}</DialogDescription>
        </DialogHeader>

        <form
          className="flex flex-col gap-4"
          onSubmit={handleSubmit}
        >
          <Input
            maxLength={200}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t("rename_chat_placeholder")}
            ref={inputRef}
            required
            value={title}
          />

          <DialogFooter>
            <LoadingButton
              disabled={trimmedTitle === "" || isUnchanged}
              isLoading={update.isPending}
              type="submit"
            >
              {tCommon("save")}
            </LoadingButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
