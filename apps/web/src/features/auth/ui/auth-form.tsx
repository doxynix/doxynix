"use client";

import { type ComponentType, type SubmitEvent, useEffect, useRef, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import {
  ArrowRight,
  CheckCircle2,
  Fingerprint,
  KeyRound,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useQueryState } from "nuqs";
import posthog from "posthog-js";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod/mini";

import { TURNSTILE_SITE_KEY } from "@/shared/config/env.client";
import { Link, useRouter } from "@/shared/i18n/navigation";
import { authClient } from "@/shared/lib/auth-client";
import { cn } from "@/shared/lib/cn";
import { setClientCookie } from "@/shared/lib/cookies";
import { Logo } from "@/shared/ui/branding/doxynix-logo";
import { AppBadge } from "@/shared/ui/core/badge";
import { AppButton } from "@/shared/ui/core/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/shared/ui/core/form";
import { Input } from "@/shared/ui/core/input";
import { YandexIcon } from "@/shared/ui/icons/yandex-icon";
import { LoadingButton } from "@/shared/ui/kit/loading-button";

function createMagicLinkSchema(invalidEmailError: string, emailTooLongError: string) {
  return z.object({
    email: z
      .email({
        error: invalidEmailError,
      })
      .check(
        z.maxLength(254, {
          error: emailTooLongError,
        }),
      ),
  });
}

type MagicLinkSchemaValue = z.infer<ReturnType<typeof createMagicLinkSchema>>;

type AllowedProviders = "yandex";

type AuthProvider = {
  icon: ComponentType<{ className?: string }>;
  provider: "yandex";
  text: string;
};

type AuthBenefit = {
  desc: string;
  icon: ComponentType<{ className?: string }>;
  title: string;
};

export function AuthForm() {
  const router = useRouter();
  const tCommon = useTranslations("Common");
  const t = useTranslations("Auth");
  const turnstileRef = useRef<TurnstileInstance>(null);
  const pendingDataRef = useRef<MagicLinkSchemaValue | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<null | string>(null);

  const MagicLinkSchema = createMagicLinkSchema(
    t("error_invalid_email"),
    t("error_email_too_long"),
  );

  const BUTTONS = [
    { icon: YandexIcon, provider: "yandex" as const, text: t("continue_with_yandex") },
  ] as const satisfies readonly AuthProvider[];

  const AUTH_BENEFITS = [
    {
      desc: t("benefit_instant_access_desc"),
      icon: Sparkles,
      title: t("benefit_instant_access_title"),
    },
    {
      desc: t("benefit_enterprise_security_desc"),
      icon: ShieldCheck,
      title: t("benefit_enterprise_security_title"),
    },
  ] as const satisfies readonly AuthBenefit[];

  const TRUST_POINTS = [
    t("trust_oauth_secure"),
    t("trust_non_custodial"),
    t("trust_cloudflare_protected"),
  ] as const;

  const [isSent, setIsSent] = useState(false);
  const [loadingProvider, setLoadingProvider] = useState<null | string>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  const lastLogin = authClient.getLastUsedLoginMethod();
  const [twoFactorParam, setTwoFactorParam] = useQueryState("two_factor");
  const isTwoFactorRequired = twoFactorParam === "true";

  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [isBackupMode, setIsBackupMode] = useState(false);
  const [isTwoFactorVerifying, setIsTwoFactorVerifying] = useState(false);

  useEffect(() => {
    void authClient.signIn.passkey({
      autoFill: true,
      fetchOptions: {
        onSuccess: () => {
          router.replace("/dashboard");
        },
      },
    });
  }, [router]);

  const form = useForm<MagicLinkSchemaValue>({
    defaultValues: { email: "" },
    resolver: zodResolver(MagicLinkSchema),
  });

  const disabled = loadingProvider != null || isVerifying || isTwoFactorVerifying;

  const proceedWithSignIn = async (values: MagicLinkSchemaValue, token: string) => {
    setIsVerifying(false);
    setLoadingProvider("email");

    setClientCookie("cf-turnstile-response", token, 300);

    try {
      await authClient.signIn.magicLink({
        callbackURL: "/dashboard",
        email: values.email,
        fetchOptions: {
          headers: {
            "x-captcha-response": token,
          },
        },
        newUserCallbackURL: "/welcome",
      });

      setIsSent(true);
      toast.success(t("sent_toast_success"));
      posthog.capture("sign_in_email_sent", { provider: "email" });
    } catch {
      toast.error(t("sent_toast_error"));
      turnstileRef.current?.reset();
      setTurnstileToken(null);
    } finally {
      setLoadingProvider(null);
      pendingDataRef.current = null;
      setTurnstileToken(null);
    }
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

  async function handleSignIn(provider: AllowedProviders) {
    try {
      setLoadingProvider(provider);
      posthog.capture("sign_in_attempted", { provider });

      const currentEmail = form.getValues("email");

      await authClient.signIn.social({
        callbackURL: "/dashboard",
        loginHint: currentEmail || undefined,
        newUserCallbackURL: "/welcome",
        provider,
      });
    } catch {
      toast.error(t("error_social_signin_failed"));
    } finally {
      setLoadingProvider(null);
    }
  }

  const handleTwoFactorVerify = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    const minLen = isBackupMode ? 8 : 6;
    if (twoFactorCode.trim().length < minLen) {
      toast.error(isBackupMode ? t("error_enter_backup_code") : t("error_enter_6digit_code"));
      return;
    }

    setIsTwoFactorVerifying(true);
    try {
      if (isBackupMode) {
        const { error } = await authClient.twoFactor.verifyBackupCode({
          code: twoFactorCode,
        });
        if (error) {
          throw new Error(error.message);
        }
      } else {
        const { error } = await authClient.twoFactor.verifyTotp({
          code: twoFactorCode,
          trustDevice: true,
        });
        if (error) {
          throw new Error(error.message);
        }
      }

      toast.success(t("success_authenticated"));
      void setTwoFactorParam(null);
      router.replace("/dashboard");
    } catch (error) {
      const msg = error instanceof Error ? error.message : t("error_verification_failed");
      toast.error(msg);
    } finally {
      setIsTwoFactorVerifying(false);
    }
  };

  const handlePasskeySignIn = async () => {
    setLoadingProvider("passkey");
    posthog.capture("sign_in_attempted", { provider: "passkey" });

    try {
      const { error } = await authClient.signIn.passkey({
        fetchOptions: {
          onSuccess: () => {
            router.replace("/dashboard");
          },
        },
      });

      if (error) {
        if ("code" in error && error.code === "NO_CREDENTIALS") {
          toast.error(t("error_no_security_keys"));
        } else {
          toast.error(error.message ?? t("error_authentication_failed"));
        }
      }
    } catch {
      toast.error(t("error_passkey_failed"));
    } finally {
      setLoadingProvider(null);
    }
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
    toast.error(t("error_verification_expired"));
  };

  const turnstileOptions = {
    action: "auth",
    size: "invisible" as const,
    theme: "dark" as const,
  };

  return (
    <section className="container relative mx-auto flex min-h-[calc(100dvh-3rem)] items-center justify-center overflow-hidden px-4">
      <div className="flex w-full items-center justify-center gap-10">
        <div
          className={cn(
            "hidden max-w-2xl flex-col gap-8 transition-all duration-300 ease-out lg:flex",
            isSent || isTwoFactorRequired
              ? "pointer-events-none absolute inset-0 scale-[0.98] opacity-0"
              : "relative scale-100 opacity-100",
          )}
          inert={isSent || isTwoFactorRequired ? true : undefined}
        >
          <div className="flex items-center gap-3">
            <Logo
              className="w-xl"
              isInteractive={false}
            />
          </div>

          <div className="flex flex-col gap-5">
            <h1 className="font-bold text-4xl xl:text-6xl">
              {t("hero_title")} <br />
              <span className="text-muted-foreground">{t("hero_subtitle")}</span>
            </h1>
            <p className="text-base text-muted-foreground">{t("hero_description")}</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {AUTH_BENEFITS.map((item) => (
              <div
                className="rounded-2xl border border-border bg-card p-5"
                key={item.title}
              >
                <div className="flex items-center gap-3">
                  <span className="flex size-9 items-center justify-center rounded-full border border-border bg-primary/10">
                    <item.icon className="text-foreground" />
                  </span>
                  <p className="font-medium text-foreground text-sm">{item.title}</p>
                </div>
                <p className="mt-3 text-muted-foreground text-sm">{item.desc}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            {TRUST_POINTS.map((item) => (
              <AppBadge
                className="text-muted-foreground"
                key={item}
                variant="outline"
              >
                {item}
              </AppBadge>
            ))}
          </div>
        </div>

        <div className="fade-in slide-in-from-bottom-4 relative flex w-full max-w-lg animate-in items-center justify-center">
          <div
            className={cn(
              "relative flex w-full flex-col gap-6 rounded-[1.75rem] border border-border bg-card p-6 transition-all duration-300 ease-out sm:p-8",
              isSent || isTwoFactorRequired
                ? "pointer-events-none absolute inset-0 scale-[0.98] opacity-0"
                : "relative scale-100 opacity-100",
            )}
            inert={isSent || isTwoFactorRequired ? true : undefined}
          >
            <div className="flex items-center justify-between gap-3 lg:hidden">
              <Logo
                className="w-24"
                isInteractive={false}
              />
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-2">
                <h2 className="font-semibold text-2xl">{t("welcome_back")}</h2>
                <p className="text-muted-foreground text-sm">{t("choose_signin_method")}</p>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              {BUTTONS.map((item) => {
                const isLastUsed = lastLogin === item.provider;
                return (
                  <LoadingButton
                    className="relative w-full cursor-pointer rounded-2xl border-border bg-background px-3 py-5 text-foreground transition-colors hover:bg-surface-hover"
                    disabled={disabled}
                    isLoading={loadingProvider === item.provider}
                    key={item.provider}
                    loadingText={t("login_loading")}
                    onClick={() => void handleSignIn(item.provider)}
                    variant="outline"
                  >
                    <div className="flex w-full items-center justify-center gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex shrink-0 items-center justify-center">
                          <item.icon />
                        </span>
                        <span className="truncate font-medium text-sm">{item.text}</span>
                      </div>
                      {isLastUsed && (
                        <AppBadge className="absolute -top-2 -right-2 text-xs">
                          {t("last_used")}
                        </AppBadge>
                      )}
                    </div>
                  </LoadingButton>
                );
              })}
              <LoadingButton
                className="relative w-full cursor-pointer rounded-2xl border-border bg-background px-3 py-5 text-foreground transition-colors hover:bg-surface-hover"
                disabled={disabled}
                isLoading={loadingProvider === "passkey"}
                loadingText={t("verifying_security_key")}
                onClick={() => void handlePasskeySignIn()}
                type="button"
                variant="outline"
              >
                <div className="flex w-full items-center justify-center gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex shrink-0 items-center justify-center">
                      <Fingerprint className="size-4 text-muted-foreground" />
                    </span>
                    <span className="truncate font-medium text-sm">
                      {t("continue_with_passkey")}
                    </span>
                  </div>
                  {lastLogin === "passkey" && (
                    <AppBadge className="absolute -top-2 -right-2 text-xs">
                      {t("last_used")}
                    </AppBadge>
                  )}
                </div>
              </LoadingButton>
            </div>

            <div className="relative w-full">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-border border-t" />
              </div>
              <div className="relative flex justify-center text-[0.7rem] uppercase">
                <span className="bg-card px-3 text-muted-foreground">{t("or_divider")}</span>
              </div>
            </div>

            <div className="flex flex-col gap-4 rounded-[1.35rem] border border-border bg-background p-5">
              <div className="flex flex-col gap-1">
                <p className="font-medium text-foreground text-sm">{t("work_email")}</p>
                <p className="text-muted-foreground text-sm">{t("work_email_description")}</p>
              </div>
              <Form {...form}>
                <form
                  className="flex w-full flex-col gap-4"
                  onSubmit={(e) => void form.handleSubmit(onSubmit)(e)}
                >
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem className="relative flex flex-col gap-2">
                        <FormLabel className="text-muted-foreground">{t("email_label")}</FormLabel>
                        <FormControl>
                          <Input
                            /* oxlint-disable-next-line jsx-a11y/autocomplete-valid */
                            autoComplete="email webauthn"
                            className="h-12"
                            disabled={disabled}
                            inputMode="email"
                            placeholder="doxynix@example.com"
                            {...field}
                          />
                        </FormControl>
                        <div className="min-h-5 px-1">
                          <FormMessage className="fade-in slide-in-from-top-1 animate-in text-xs" />
                        </div>
                        {lastLogin === "magic-link" && (
                          <AppBadge className="absolute top-2 -right-2 text-xs">
                            {t("last_used")}
                          </AppBadge>
                        )}
                      </FormItem>
                    )}
                  />
                  <LoadingButton
                    className="h-12 w-full cursor-pointer rounded-2xl"
                    disabled={disabled}
                    isLoading={loadingProvider === "email" || isVerifying}
                    loadingText={isVerifying ? t("security_check") : t("login_loading")}
                    type="submit"
                  >
                    {tCommon("login_btn")}
                  </LoadingButton>
                </form>
              </Form>
            </div>

            <p className="text-center text-muted-foreground text-xs">
              {t("terms_agreement")}{" "}
              <Link
                className="text-foreground underline decoration-border-accent underline-offset-4 hover:no-underline"
                href="/terms"
              >
                {tCommon("terms_of_service")}
              </Link>{" "}
              {tCommon("and")}{" "}
              <Link
                className="text-foreground underline decoration-border-accent underline-offset-4 hover:no-underline"
                href="/privacy"
              >
                {tCommon("privacy_policy")}
              </Link>
            </p>
          </div>

          <div
            className={cn(
              "relative flex w-full flex-col gap-6 rounded-[1.75rem] border border-border bg-card p-6 text-center transition-all duration-300 ease-out sm:p-8",
              isTwoFactorRequired
                ? "relative scale-100 opacity-100"
                : "pointer-events-none absolute inset-0 scale-[0.98] opacity-0",
            )}
            inert={!isTwoFactorRequired ? true : undefined}
          >
            <div className="flex w-full items-center justify-between border-b pb-4">
              <div className="flex items-center gap-2">
                <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                  {isBackupMode ? <KeyRound size={20} /> : <ShieldCheck size={20} />}
                </div>
                <div className="text-left">
                  <h3 className="font-semibold text-sm">
                    {isBackupMode ? t("backup_recovery") : t("two_factor_verification")}
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
                    {isBackupMode ? t("use_recovery_code") : t("enter_totp_code")}
                  </p>
                </div>
              </div>
              <AppButton
                onClick={() => void setTwoFactorParam(null)}
                size="icon"
                variant="ghost"
              >
                <X size={16} />
              </AppButton>
            </div>

            <form
              className="flex flex-col gap-4 py-2"
              onSubmit={(e) => void handleTwoFactorVerify(e)}
            >
              <Input
                className="h-12 rounded-2xl text-center font-mono text-lg tracking-widest"
                disabled={isTwoFactorVerifying}
                maxLength={isBackupMode ? 10 : 6}
                onChange={(e) => setTwoFactorCode(e.target.value)}
                placeholder={isBackupMode ? "XXXX-XXXX" : "000000"}
                value={twoFactorCode}
              />

              <LoadingButton
                className="h-12 w-full cursor-pointer gap-2 rounded-2xl"
                disabled={
                  twoFactorCode.trim().length === 0 ||
                  isTwoFactorVerifying ||
                  twoFactorCode.trim().length < 6
                }
                isLoading={isTwoFactorVerifying}
                loadingText={t("verifying")}
                type="submit"
              >
                {t("verify")} <ArrowRight size={16} />
              </LoadingButton>

              <AppButton
                className="mx-auto text-muted-foreground text-xs hover:text-foreground"
                disabled={isTwoFactorVerifying}
                onClick={() => {
                  setIsBackupMode(!isBackupMode);
                  setTwoFactorCode("");
                }}
                type="button"
                variant="link"
              >
                {isBackupMode ? t("back_to_authenticator") : t("use_backup_code")}
              </AppButton>
            </form>
          </div>

          <div
            className={cn(
              "relative flex w-full flex-col items-center justify-center gap-4 rounded-[1.75rem] border border-border bg-card p-8 text-center transition-all duration-300 ease-out",
              isSent
                ? "relative scale-100 opacity-100"
                : "pointer-events-none absolute inset-0 scale-[0.98] opacity-0",
            )}
            inert={!isSent ? true : undefined}
          >
            <div className="mb-2 flex size-20 items-center justify-center rounded-full">
              <CheckCircle2 className="size-16 text-foreground" />
            </div>
            <h2 className="font-semibold text-2xl">{t("check_email_title")}</h2>
            <p className="max-w-sm text-muted-foreground text-sm">
              {t("check_email_desc")}{" "}
              <span className="font-semibold text-foreground italic">
                {form.getValues("email")}
              </span>
            </p>
            <AppButton
              className="mt-2 cursor-pointer"
              onClick={() => setIsSent(false)}
              variant="outline"
            >
              {t("enter_different_email")}
            </AppButton>
          </div>
        </div>
      </div>
      <Turnstile
        className={cn("mx-auto mt-2", (isSent || isTwoFactorRequired) && "hidden")}
        onError={onTurnstileError}
        onExpire={onTurnstileExpire}
        onSuccess={onTurnstileSuccess}
        options={turnstileOptions}
        ref={turnstileRef}
        siteKey={TURNSTILE_SITE_KEY}
      />
    </section>
  );
}
