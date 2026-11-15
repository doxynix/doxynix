"use client";

import { AlertCircle, RefreshCcw } from "lucide-react";
import { useTranslations } from "next-intl";

import { useErrorMessage } from "@/shared/i18n/use-error-message";
import { cn } from "@/shared/lib/cn";
import { AppButton } from "@/shared/ui/core/button";

import { EmptyState } from "./empty-state";

type Props = {
  className?: string;
  error: unknown;
  onRetry: () => void;
};

// A failed read must never leave a skeleton on screen forever; the message comes from the server
// payload when there is one, and the button re-runs the same query.
export function QueryError({ className, error, onRetry }: Readonly<Props>) {
  const t = useTranslations("Common");
  const errorMessage = useErrorMessage();

  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-xl border border-dashed p-6",
        className,
      )}
    >
      <EmptyState
        action={
          <AppButton
            onClick={onRetry}
            variant="outline"
          >
            <RefreshCcw /> {t("retry")}
          </AppButton>
        }
        description={errorMessage(error)}
        icon={AlertCircle}
        title={t("error_title")}
      />
    </div>
  );
}
