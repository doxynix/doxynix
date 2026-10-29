"use client";

import { Check, ChevronsUpDown } from "lucide-react";
import { useTranslations } from "next-intl";

import { AppBadge } from "@/shared/ui/core/badge";
import { AppButton } from "@/shared/ui/core/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/core/dropdown-menu";

import { useWorkspace } from "@/entities/workspace/model/workspace-context";

export function WorkspaceSwitcher() {
  const t = useTranslations("Dashboard");
  const { activeWorkspace, items, switchWorkspace } = useWorkspace();

  if (activeWorkspace == null) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <AppButton
          className="max-w-[240px] justify-between gap-2"
          variant="ghost"
        >
          <span className="truncate">{activeWorkspace.name}</span>
          <AppBadge variant="secondary">
            {activeWorkspace.entitlement?.planCode ?? "HOBBY"}
          </AppBadge>
          <ChevronsUpDown className="size-3 text-muted-foreground" />
        </AppButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="w-72"
      >
        <DropdownMenuLabel>{t("workspace_switcher_label")}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {items.map((workspace) => (
          <DropdownMenuItem
            key={workspace.id}
            onSelect={() => switchWorkspace(workspace.id)}
          >
            <div className="flex w-full items-center justify-between gap-2">
              <span className="truncate">{workspace.name}</span>
              <span className="flex items-center gap-1">
                <AppBadge variant="outline">
                  {workspace.role === "OWNER"
                    ? t("workspace_role_owner")
                    : t("workspace_role_member")}
                </AppBadge>
                {workspace.id === activeWorkspace.id && <Check className="size-3" />}
              </span>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
