"use client";

import { useQuery } from "@tanstack/react-query";
import { UserMinus } from "lucide-react";
import { useTranslations } from "next-intl";

import { useTRPC } from "@/shared/api/trpc";
import { Link } from "@/shared/i18n/navigation";
import { AppBadge } from "@/shared/ui/core/badge";
import { AppButton } from "@/shared/ui/core/button";
import { Skeleton } from "@/shared/ui/core/skeleton";
import { AppAvatar } from "@/shared/ui/kit/app-avatar";
import { AppTooltip } from "@/shared/ui/kit/app-tooltip";

import { useWorkspace } from "@/entities/workspace/model/workspace-context";

import { InviteMemberDialog } from "./invite-member-dialog";
import { RemoveMemberDialog } from "./remove-member-dialog";

export function WorkspaceMembersPage() {
  const trpc = useTRPC();
  const t = useTranslations("Dashboard");
  const { activeWorkspace, isOwner } = useWorkspace();
  const { data, isLoading } = useQuery(trpc.workspace.members.queryOptions());

  const ownerCount = data?.items.filter((member) => member.role === "OWNER").length ?? 0;

  const planCode = activeWorkspace?.entitlement?.planCode ?? "HOBBY";
  const isHobby = planCode === "HOBBY";

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <h3 className="font-medium text-lg">{t("settings_members_list_title")}</h3>
        {isOwner &&
          (isHobby ? (
            <AppButton asChild>
              <Link href="/dashboard/settings/billing">{t("settings_members_upgrade")}</Link>
            </AppButton>
          ) : (
            <InviteMemberDialog />
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
                <AppAvatar
                  alt={member.user.name ?? t("settings_members_unnamed")}
                  fallbackText={member.user.name ?? ""}
                  src={member.user.image ?? undefined}
                />
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
                {isOwner &&
                  (member.role === "OWNER" && ownerCount <= 1 ? (
                    <AppTooltip content={t("settings_members_error_last_owner")}>
                      <span className="inline-flex">
                        <AppButton
                          aria-label={t("settings_members_error_last_owner")}
                          disabled
                          size="icon"
                          variant="ghost"
                        >
                          <UserMinus />
                        </AppButton>
                      </span>
                    </AppTooltip>
                  ) : (
                    <RemoveMemberDialog
                      memberName={member.user.name ?? t("settings_members_unnamed")}
                      userId={member.userId}
                    />
                  ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
