"use client";

import { type SubmitEvent, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Mail, RefreshCw, UserPlus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";

import { useTRPC } from "@/shared/api/trpc";
import { APP_URL } from "@/shared/config/env.client";
import { useErrorMessage } from "@/shared/i18n/use-error-message";
import { formatShortDate } from "@/shared/lib/date-utils";
import { AppButton } from "@/shared/ui/core/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/ui/core/dialog";
import { Input } from "@/shared/ui/core/input";
import { Label } from "@/shared/ui/core/label";
import { Skeleton } from "@/shared/ui/core/skeleton";
import { SkeletonText } from "@/shared/ui/kit/app-skeleton";
import { CopyButton } from "@/shared/ui/kit/copy-button";
import { LoadingButton } from "@/shared/ui/kit/loading-button";
import { QrCode } from "@/shared/ui/kit/qr-code";

import { useWorkspace } from "@/entities/workspace/model/workspace-context";

type InviteLink = { expiresAt: Date; token: string; workspaceId: string };

function InviteUrlRow({ value }: Readonly<{ value: string }>) {
  const tCommon = useTranslations("Common");

  return (
    <div className="flex w-full min-w-0 items-center gap-2 rounded-xl border p-2">
      <span className="min-w-0 flex-1 truncate font-mono text-xs">{value}</span>
      <CopyButton
        alwaysVisible={true}
        className="-my-1 size-6 shrink-0"
        tooltipText={tCommon("copy")}
        value={value}
      />
    </div>
  );
}

export function InviteMemberDialog() {
  const trpc = useTRPC();
  const t = useTranslations("Dashboard");
  const tCommon = useTranslations("Common");
  const locale = useLocale();
  const errorMessage = useErrorMessage();
  const { activeWorkspaceId } = useWorkspace();

  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [linkInvite, setLinkInvite] = useState<InviteLink | null>(null);
  const [manualInviteUrl, setManualInviteUrl] = useState<null | string>(null);

  const emailMutation = useMutation(
    trpc.workspace.createInvite.mutationOptions({
      onError: (error) => {
        toast.error(errorMessage(error));
      },
      onSuccess: (data) => {
        setEmail("");

        if (data.emailSent) {
          setManualInviteUrl(null);
          toast.success(t("invite_email_sent"));
          return;
        }

        // The invite exists even when Resend is not configured; the owner can forward the link.
        setManualInviteUrl(`${APP_URL}/invite/${data.token}`);
        toast.warning(t("invite_email_not_sent"));
      },
    }),
  );

  const linkMutation = useMutation(
    trpc.workspace.createInvite.mutationOptions({
      onError: (error) => {
        toast.error(errorMessage(error));
      },
    }),
  );

  const linkData =
    linkInvite == null || linkInvite.workspaceId !== activeWorkspaceId
      ? null
      : { expiresAt: linkInvite.expiresAt, url: `${APP_URL}/invite/${linkInvite.token}` };

  const requestLink = () => {
    if (linkMutation.isPending) {
      return;
    }

    // Tag the result with the workspace that requested it: a switch while the request is in
    // flight must not show the old workspace's link under the new one.
    const workspaceId = activeWorkspaceId;
    linkMutation.mutate(
      {},
      {
        onSuccess: (data) => {
          setLinkInvite({ expiresAt: data.expiresAt, token: data.token, workspaceId });
        },
      },
    );
  };

  const handleOpenChange = (next: boolean) => {
    setOpen(next);

    if (next) {
      if (linkData == null) {
        requestLink();
      }
      return;
    }

    setEmail("");
    setManualInviteUrl(null);
    emailMutation.reset();
  };

  const handleEmailSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmed = email.trim();

    if (trimmed === "") {
      return;
    }

    emailMutation.mutate({ email: trimmed });
  };

  return (
    <Dialog
      onOpenChange={handleOpenChange}
      open={open}
    >
      <DialogTrigger asChild>
        <AppButton
          className="gap-1.5"
          size="sm"
          variant="outline"
        >
          <UserPlus />
          {t("invite_dialog_title")}
        </AppButton>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("invite_dialog_title")}</DialogTitle>
          <DialogDescription>{t("invite_dialog_desc")}</DialogDescription>
        </DialogHeader>

        <form
          className="flex flex-col gap-2"
          onSubmit={handleEmailSubmit}
        >
          <Label htmlFor="invite-email">{t("settings_members_add_email_label")}</Label>
          <div className="flex items-center gap-2">
            <Input
              autoComplete="off"
              id="invite-email"
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("settings_members_add_email_placeholder")}
              required
              spellCheck={false}
              type="email"
              value={email}
            />
            <LoadingButton
              className="shrink-0 gap-1.5"
              disabled={email.trim() === ""}
              isLoading={emailMutation.isPending}
              type="submit"
            >
              <Mail />
              {t("invite_email_send")}
            </LoadingButton>
          </div>

          {manualInviteUrl != null && (
            <div className="mt-1">
              <InviteUrlRow value={manualInviteUrl} />
            </div>
          )}
        </form>

        <div className="flex items-center gap-3 text-muted-foreground text-xs">
          <span className="h-px flex-1 bg-border" />
          {t("invite_link_section")}
          <span className="h-px flex-1 bg-border" />
        </div>

        <div className="flex w-full min-w-0 flex-col items-center gap-6 py-4">
          {linkData != null ? (
            <>
              <QrCode value={linkData.url} />

              <InviteUrlRow value={linkData.url} />

              <p className="text-center text-muted-foreground text-xs">
                {t("invite_dialog_expires", {
                  date: formatShortDate(linkData.expiresAt, locale),
                })}
              </p>
            </>
          ) : linkMutation.error != null ? (
            <AppButton
              className="w-fit gap-1.5"
              onClick={requestLink}
              variant="outline"
            >
              <RefreshCw />
              {tCommon("retry")}
            </AppButton>
          ) : (
            <>
              <Skeleton className="size-49" />
              <div className="flex w-full min-w-0 items-center gap-2 rounded-xl border p-2">
                <SkeletonText
                  className="min-w-0 flex-1"
                  lines={1}
                  size="sm"
                  widths={["w-full"]}
                />
                <Skeleton className="-my-1 size-6 shrink-0" />
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
