"use client";

import { MessageCode } from "@doxynix/shared";
import { AlertCircle, X } from "lucide-react";
import { useTranslations } from "next-intl";

import { Link } from "@/shared/i18n/navigation";
import { readErrorPayload, useErrorMessage } from "@/shared/i18n/use-error-message";
import { cn } from "@/shared/lib/cn";
import { Alert, AlertDescription, AlertTitle } from "@/shared/ui/core/alert";
import { AppButton } from "@/shared/ui/core/button";

type Props = {
  className?: string;
  error: unknown;
  onDismiss: () => void;
};

// Shared inline failure for actions that spend AI quota (chat, analysis, audit, docs): the raw
// error never reaches the user, and a quota failure offers the billing escape hatch.
export function ActionErrorAlert({ className, error, onDismiss }: Readonly<Props>) {
  const t = useTranslations("Common");
  const errorMessage = useErrorMessage();
  const { messageCode } = readErrorPayload(error);
  const isBillingError =
    messageCode === MessageCode.AI_LIMIT_EXCEEDED || messageCode === MessageCode.PAYMENT_REQUIRED;

  return (
    <Alert
      className={cn("relative pr-10", className)}
      variant="destructive"
    >
      <AlertCircle />
      <AlertTitle>{t("error_title")}</AlertTitle>
      <AlertDescription className="gap-2">
        <p>{errorMessage(error)}</p>
        {isBillingError && (
          <AppButton
            asChild
            className="h-auto p-0 text-xs"
            size="sm"
            variant="link"
          >
            <Link href="/dashboard/settings/billing">{t("manage_billing")}</Link>
          </AppButton>
        )}
      </AlertDescription>
      <AppButton
        aria-label={t("close")}
        className="absolute top-2 right-2 size-7"
        onClick={onDismiss}
        size="icon"
        variant="ghost"
      >
        <X />
      </AppButton>
    </Alert>
  );
}
