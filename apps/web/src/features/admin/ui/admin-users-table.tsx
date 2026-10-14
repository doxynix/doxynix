"use client";

import { useState } from "react";
import { UserRole } from "@doxynix/shared";
import { Ban, ShieldCheck, ShieldOff, Trash2, Undo2, Users } from "lucide-react";
import { useTranslations } from "next-intl";

import { AppBadge } from "@/shared/ui/core/badge";
import { AppButton } from "@/shared/ui/core/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/core/table";
import { AppTooltip } from "@/shared/ui/kit/app-tooltip";
import { EmptyState } from "@/shared/ui/kit/empty-state";

import type { AdminUser } from "@/entities/user/model/user.types";

import { nextRole } from "../model/next-role";
import type { AdminUserActions } from "../model/use-admin-user-actions";
import { AdminUserSheet } from "./admin-user-sheet";
import { BanUserDialog } from "./ban-user-dialog";
import { DeleteUserDialog } from "./delete-user-dialog";

type Props = {
  actions: AdminUserActions;
  users: AdminUser[];
};

export function AdminUsersTable({ actions, users }: Readonly<Props>) {
  const t = useTranslations("AdminUsers");
  const [detailId, setDetailId] = useState<string | null>(null);

  if (users.length === 0) {
    return (
      <EmptyState
        description={t("empty_desc")}
        icon={Users}
        title={t("empty_title")}
      />
    );
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("col_user")}</TableHead>
            <TableHead>{t("col_role")}</TableHead>
            <TableHead>{t("col_status")}</TableHead>
            <TableHead>{t("col_created")}</TableHead>
            <TableHead className="text-right">{t("col_actions")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => (
            <TableRow
              className="group cursor-pointer"
              key={user.id}
              onClick={() => setDetailId(user.id)}
            >
              <TableCell>
                <div className="flex flex-col">
                  <span className="font-medium text-sm">{user.name ?? user.id}</span>
                  <span className="text-muted-foreground text-xs">{user.email}</span>
                </div>
              </TableCell>

              <TableCell>
                <AppBadge variant={user.role === UserRole.ADMIN ? "default" : "secondary"}>
                  {user.role === UserRole.ADMIN ? t("role_admin") : t("role_user")}
                </AppBadge>
              </TableCell>

              <TableCell>
                <AppBadge variant={user.banned ? "destructive" : "outline"}>
                  {user.banned ? t("banned_badge") : t("status_active")}
                </AppBadge>
                {user.banned && user.banExpires != null && (
                  <span className="mt-1 block text-muted-foreground text-xs">
                    {t("ban_until", {
                      date: new Date(user.banExpires).toLocaleString(),
                    })}
                  </span>
                )}
              </TableCell>

              <TableCell className="text-muted-foreground text-sm">
                {new Date(user.createdAt).toLocaleDateString()}
              </TableCell>

              <TableCell
                className="text-right"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <AppTooltip
                    content={
                      user.role === UserRole.ADMIN
                        ? t("role_action_demote")
                        : t("role_action_promote")
                    }
                  >
                    <AppButton
                      aria-label={
                        user.role === UserRole.ADMIN
                          ? t("role_action_demote")
                          : t("role_action_promote")
                      }
                      onClick={() =>
                        actions.setRole.mutate({ id: user.id, role: nextRole(user.role) })
                      }
                      size="icon"
                      variant="ghost"
                    >
                      {user.role === UserRole.ADMIN ? <ShieldOff /> : <ShieldCheck />}
                    </AppButton>
                  </AppTooltip>

                  {user.banned ? (
                    <AppTooltip content={t("unban_action")}>
                      <AppButton
                        aria-label={t("unban_action")}
                        onClick={() => actions.setBanned.mutate({ banned: false, id: user.id })}
                        size="icon"
                        variant="ghost"
                      >
                        <Undo2 />
                      </AppButton>
                    </AppTooltip>
                  ) : (
                    <BanUserDialog
                      actions={actions}
                      trigger={
                        <AppButton
                          aria-label={t("ban_action")}
                          className="text-destructive"
                          size="icon"
                          variant="ghost"
                        >
                          <Ban />
                        </AppButton>
                      }
                      user={user}
                    />
                  )}

                  <DeleteUserDialog
                    actions={actions}
                    trigger={
                      <AppButton
                        aria-label={t("delete_action")}
                        className="text-destructive"
                        size="icon"
                        variant="ghost"
                      >
                        <Trash2 />
                      </AppButton>
                    }
                    user={user}
                  />
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {detailId != null && (
        <AdminUserSheet
          actions={actions}
          onOpenChange={(open) => {
            if (!open) {
              setDetailId(null);
            }
          }}
          open
          userId={detailId}
        />
      )}
    </>
  );
}
