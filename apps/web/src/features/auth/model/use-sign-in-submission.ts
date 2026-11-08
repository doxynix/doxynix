"use client";

import { useRef, useState } from "react";
import type { TurnstileInstance } from "@marsidev/react-turnstile";
import { useTranslations } from "next-intl";
import type { UseFormReturn } from "react-hook-form";
import { toast } from "sonner";

import { authClient } from "@/shared/lib/auth-client";
import { setClientCookie } from "@/shared/lib/cookies";
import { trackClientEvent } from "@/shared/lib/posthog-client";

import type { MagicLinkSchemaValue } from "./magic-link";

export type AllowedProviders = "yandex";

type Options = {
  form: UseFormReturn<MagicLinkSchemaValue>;
  newUserTarget: string;
  target: string;
};

export function useSignInSubmission({ form, newUserTarget, target }: Options) {
  const t = useTranslations("Auth");
  const turnstileRef = useRef<TurnstileInstance>(null);
  const pendingDataRef = useRef<MagicLinkSchemaValue | null>(null);

  const [turnstileToken, setTurnstileToken] = useState<null | string>(null);
  const [isSent, setIsSent] = useState(false);
  const [sentEmail, setSentEmail] = useState<string | null>(null);
  const [loadingProvider, setLoadingProvider] = useState<null | string>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  const proceedWithSignIn = async (values: MagicLinkSchemaValue, token: string) => {
    setIsVerifying(false);
    setLoadingProvider("email");

    setClientCookie("cf-turnstile-response", token, 300);

    await authClient.signIn
      .magicLink({
        callbackURL: target,
        email: values.email,
        fetchOptions: {
          headers: {
            "x-captcha-response": token,
          },
        },
        newUserCallbackURL: newUserTarget,
      })
      .then(() => {
        setSentEmail(values.email);
        setIsSent(true);
        toast.success(t("sent_toast_success"));
        trackClientEvent("sign_in_email_sent", { provider: "email" });
      })
      .catch(() => {
        toast.error(t("sent_toast_error"));
        turnstileRef.current?.reset();
        setTurnstileToken(null);
      })
      .finally(() => {
        setLoadingProvider(null);
        pendingDataRef.current = null;
        setTurnstileToken(null);
      });
  };

  const onSubmit = async (values: MagicLinkSchemaValue) => {
    if (turnstileToken != null) {
      await proceedWithSignIn(values, turnstileToken);
      return;
    }

    setIsVerifying(true);
    pendingDataRef.current = values;

    if (turnstileRef.current == null) {
      setIsVerifying(false);
      pendingDataRef.current = null;
      return;
    }

    turnstileRef.current.reset();
  };

  const signIn = async (provider: AllowedProviders) => {
    setLoadingProvider(provider);
    trackClientEvent("sign_in_attempted", { provider });

    const currentEmail = form.getValues("email");

    await authClient.signIn
      .social({
        callbackURL: target,
        loginHint: currentEmail || undefined,
        newUserCallbackURL: newUserTarget,
        provider,
      })
      .catch(() => {
        toast.error(t("error_social_signin_failed"));
      })
      .finally(() => {
        setLoadingProvider(null);
      });
  };

  const onTurnstileSuccess = (token: string) => {
    setTurnstileToken(token);

    const data = pendingDataRef.current;
    if (data) {
      void proceedWithSignIn(data, token);
    }
  };

  const onTurnstileError = () => {
    setTurnstileToken(null);
    setIsVerifying(false);
    pendingDataRef.current = null;
    toast.error(t("error_verification_service"));
  };

  const onTurnstileExpire = () => {
    if (isSent || loadingProvider === "email") {
      return;
    }

    setTurnstileToken(null);
    setIsVerifying(false);
    pendingDataRef.current = null;
  };

  return {
    isSent,
    isVerifying,
    loadingProvider,
    onSubmit,
    onTurnstileError,
    onTurnstileExpire,
    onTurnstileSuccess,
    reset: () => setIsSent(false),
    sentEmail,
    signIn,
    turnstileRef,
  };
}
