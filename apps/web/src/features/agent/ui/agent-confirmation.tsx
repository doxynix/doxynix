"use client";

import { ShieldAlert } from "lucide-react";
import { useTranslations } from "next-intl";

import { AppButton } from "@/shared/ui/core/button";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/shared/ui/core/item";

type Props = {
  approvalId: string;
  args?: unknown;
  label: string;
  onRespond: (options: { approved: boolean; id: string; reason?: string }) => void;
};

function formatArgs(args: unknown): null | string {
  if (args == null) {
    return null;
  }

  try {
    const serialized = JSON.stringify(args, null, 2);
    return serialized.length > 1200 ? `${serialized.slice(0, 1200)}…` : serialized;
  } catch {
    return null;
  }
}

export function AgentConfirmation({ approvalId, args, label, onRespond }: Readonly<Props>) {
  const t = useTranslations("Agent");
  const preview = formatArgs(args);

  return (
    <Item
      className="my-2 w-full"
      size="sm"
      variant="outline"
    >
      <ItemMedia variant="icon">
        <ShieldAlert className="text-warning" />
      </ItemMedia>
      <ItemContent>
        <ItemTitle>{t("action_requires_confirmation")}</ItemTitle>
        <ItemDescription>
          {t("agent_requesting_approval_to")} <strong className="text-foreground">{label}</strong>
        </ItemDescription>
        {preview != null && (
          <pre className="no-scrollbar mt-1 max-h-24 overflow-auto rounded-lg border bg-muted/40 p-2 font-mono text-[10px] text-muted-foreground">
            {preview}
          </pre>
        )}
      </ItemContent>
      <ItemActions>
        <AppButton
          onClick={() =>
            onRespond({
              approved: false,
              id: approvalId,
              reason: t("denied_by_user"),
            })
          }
          size="sm"
          variant="ghost"
        >
          {t("deny")}
        </AppButton>
        <AppButton
          onClick={() => onRespond({ approved: true, id: approvalId })}
          size="sm"
        >
          {t("approve")}
        </AppButton>
      </ItemActions>
    </Item>
  );
}
