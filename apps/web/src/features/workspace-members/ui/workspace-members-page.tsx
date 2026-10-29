"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import { useTRPC } from "@/shared/api/trpc";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/ui/core/avatar";
import { AppBadge } from "@/shared/ui/core/badge";
import { AppButton } from "@/shared/ui/core/button";
import { Skeleton } from "@/shared/ui/core/skeleton";

import { useWorkspace } from "@/entities/workspace/model/workspace-context";

import { useMemberActions } from "../model/use-member-actions";
import { AddMemberDialog } from "./add-member-dialog";
import { RemoveMemberDialog } from "./remove-member-dialog";

function initials(name: null | string): string {
  return (name ?? "?").slice(0, 2).toUpperCase();
}

export function WorkspaceMembersPage() {
  const trpc = useTRPC();
  const t = useTranslations("Dashboard");
  const { activeWorkspace, isOwner } = useWorkspace();
  const { upgrade } = useMemberActions();
  const { data, isLoading } = useQuery(trpc.workspace.members.queryOptions());

  const planCode = activeWorkspace?.entitlement?.planCode ?? "HOBBY";
  const isHobby = planCode === "HOBBY";

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <h3 className="font-medium text-lg">{t("settings_members_list_title")}</h3>
        {isOwner &&
          (isHobby ? (
            <AppButton
              disabled={upgrade.isPending}
              onClick={() => upgrade.mutate()}
            >
              {t("settings_members_upgrade")}
            </AppButton>
          ) : (
            <AddMemberDialog />
          ))}
      </div>

      {isOwner && isHobby && (
        <p className="text-muted-foreground text-sm">{t("settings_members_upgrade_desc")}</p>
      )}
      {!isOwner && (
        <p className="text-muted-foreground text-sm">{t("settings_members_read_only")}</p>
      )}

      {isLoading || data == null ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {data.items.map((member) => (
            <div
              className="flex items-center justify-between gap-3 rounded-xl border p-3"
              key={member.id}
            >
              <div className="flex min-w-0 items-center gap-3">
                <Avatar>
                  <AvatarImage src={member.user.image ?? undefined} />
                  <AvatarFallback>{initials(member.user.name)}</AvatarFallback>
                </Avatar>
                <div className="flex min-w-0 flex-col">
                  <span className="truncate font-medium">
                    {member.user.name ?? t("settings_members_unnamed")}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {member.role === "OWNER"
                      ? t("settings_members_role_owner")
                      : t("settings_members_role_member")}
                  </span>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <AppBadge variant={member.role === "OWNER" ? "default" : "outline"}>
                  {member.role === "OWNER"
                    ? t("settings_members_role_owner")
                    : t("settings_members_role_member")}
                </AppBadge>
                {isOwner && (
                  <RemoveMemberDialog
                    memberName={member.user.name ?? t("settings_members_unnamed")}
                    userId={member.userId}
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
