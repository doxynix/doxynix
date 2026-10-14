"use client";

import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { trpc } from "@/shared/api/trpc";

export function useBannedEmailActions() {
  const t = useTranslations("AdminBannedEmails");
  const utils = trpc.useUtils();

  const invalidate = () => void utils.bannedEmail.list.invalidate();

  const onError = (error: { message: string }) => toast.error(error.message);

  const create = trpc.bannedEmail.create.useMutation({
    onError,
    onSuccess: (entry) => {
      invalidate();
      toast.success(t("toast_created", { email: entry.email }));
    },
  });

  const remove = trpc.bannedEmail.remove.useMutation({
    onError,
    onSuccess: () => {
      invalidate();
      toast.success(t("toast_removed"));
    },
  });

  return { create, remove };
}

export type BannedEmailActions = ReturnType<typeof useBannedEmailActions>;
