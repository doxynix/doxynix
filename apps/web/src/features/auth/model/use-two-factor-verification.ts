"use client";

import type { SubmitEvent } from "react";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQueryState } from "nuqs";
import { toast } from "sonner";

import { useRouter } from "@/shared/i18n/navigation";
import { authClient } from "@/shared/lib/auth-client";

import { codeLengthFor } from "./two-factor-code";

export function useTwoFactorVerification({ target }: { target: string }) {
  const t = useTranslations("Auth");
  const router = useRouter();
  const [twoFactorParam, setTwoFactorParam] = useQueryState("two_factor");
  const [code, setCode] = useState("");
  const [isBackupMode, setIsBackupMode] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  const isRequired = twoFactorParam === "true";

  const verify = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedCode = code.trim();

    if (trimmedCode.length < codeLengthFor(isBackupMode)) {
      toast.error(isBackupMode ? t("error_enter_backup_code") : t("error_enter_6digit_code"));
      return;
    }

    setIsVerifying(true);

    const verification = isBackupMode
      ? authClient.twoFactor.verifyBackupCode({ code: trimmedCode }).then(({ error }) => {
          if (error) {
            throw new Error(error.message);
          }
        })
      : authClient.twoFactor
          .verifyTotp({ code: trimmedCode, trustDevice: true })
          .then(({ error }) => {
            if (error) {
              throw new Error(error.message);
            }
          });

    await verification
      .then(() => {
        toast.success(t("success_authenticated"));
        void setTwoFactorParam(null);
        router.replace(target);
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : t("error_verification_failed");
        toast.error(message);
      })
      .finally(() => {
        setIsVerifying(false);
      });
  };

  const dismiss = () => void setTwoFactorParam(null);

  const toggleBackupMode = () => {
    setIsBackupMode(!isBackupMode);
    setCode("");
  };

  return {
    code,
    dismiss,
    isBackupMode,
    isRequired,
    isVerifying,
    setCode,
    toggleBackupMode,
    verify,
  };
}
