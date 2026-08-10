"use client";

import { useEffect, useRef, useState, type ComponentType } from "react";
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
import { z } from "zod";

import { TURNSTILE_SITE_KEY } from "@/shared/constants/env.client";
import { Link, useRouter } from "@/shared/i18n/routing";
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

const MagicLinkSchema = z.object({
  email: z
    .email("Please enter a valid email address")
    .max(254, "Email address cannot exceed 254 characters"),
});

type MagicLinkSchemaValue = z.infer<typeof MagicLinkSchema>;

type AllowedProviders = "yandex";

type AuthProvider = {
  icon: ComponentType<{ className?: string }>;
  provider: "yandex";
  text: string;
};

const BUTTONS = [
  { icon: YandexIcon, provider: "yandex", text: "Continue with Yandex" },
] as const satisfies readonly AuthProvider[];

type AuthBenefit = {
  desc: string;
  icon: ComponentType<{ className?: string }>;
  title: string;
};

const AUTH_BENEFITS = [
  {
    desc: "Seamless integration with your existing workflow and identity providers.",
    icon: Sparkles,
    title: "Instant Access",
  },
  {
    desc: "Your source code stays private. We only process metadata for analysis.",
    icon: ShieldCheck,
    title: "Enterprise Security",
  },
] as const satisfies readonly AuthBenefit[];

const TRUST_POINTS = [
  "OAuth 2.0 Secure",
  "Non-custodial analysis",
  "Cloudflare Protected",
] as const;

export function AuthForm() {
  const router = useRouter();
  const tCommon = useTranslations("Common");
  const t = useTranslations("Auth");
  const turnstileRef = useRef<TurnstileInstance>(null);
  const pendingDataRef = useRef<MagicLinkSchemaValue | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<null | string>(null);

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
  }, []);

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
      toast.error("Social sign-in failed. Please try again.");
    } finally {
      setLoadingProvider(null);
    }
  }

  const handleTwoFactorVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    const minLen = isBackupMode ? 8 : 6;
    if (twoFactorCode.trim().length < minLen) {
      toast.error(isBackupMode ? "Enter a valid backup code" : "Enter the 6-digit code");
      return;
    }

    setIsTwoFactorVerifying(true);
    try {
      if (isBackupMode) {
        const { error } = await authClient.twoFactor.verifyBackupCode({
          code: twoFactorCode,
        });
        if (error) throw new Error(error.message);
      } else {
        const { error } = await authClient.twoFactor.verifyTotp({
          code: twoFactorCode,
          trustDevice: true,
        });
        if (error) throw new Error(error.message);
      }

      toast.success("Authenticated successfully!");
      void setTwoFactorParam(null);
      router.replace("/dashboard");
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Verification failed";
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
          toast.error(
            "No security keys found on this device. Please log in using email or social accounts first."
          );
        } else {
          toast.error(error.message ?? "Authentication failed");
        }
      }
    } catch {
      toast.error("Passkey authentication failed. Please try another method.");
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
    toast.error("Verification service error.");
  };

  const onTurnstileExpire = () => {
    if (isSent || loadingProvider === "email") return;

    setTurnstileToken(null);
    setIsVerifying(false);
    pendingDataRef.current = null;
    toast.error("Verification expired.");
  };

  const turnstileOptions = {
    action: "auth",
    size: "invisible" as const,
    theme: "dark" as const,
  };

  return (
    <section className="relative container mx-auto flex min-h-[calc(100dvh-3rem)] items-center justify-center overflow-hidden px-4">
      <div className="flex w-full items-center justify-center gap-10">
        <div
          inert={isSent || isTwoFactorRequired ? true : undefined}
          className={cn(
            "hidden max-w-2xl flex-col gap-8 transition-all duration-300 ease-out lg:flex",
            isSent || isTwoFactorRequired
              ? "pointer-events-none absolute inset-0 scale-[0.98] opacity-0"
              : "relative scale-100 opacity-100"
          )}
        >
          <div className="flex items-center gap-3">
            <Logo isInteractive={false} className="w-xl" />
          </div>

          <div className="flex flex-col gap-5">
            <h1 className="text-4xl font-bold xl:text-6xl">
              Engineering insights, <br />
              <span className="text-muted-foreground">delivered instantly.</span>
            </h1>
            <p className="text-muted-foreground text-base">
              Step into your workspace to analyze repository health, generate precise documentation,
              and track engineering velocity. Clean, secure, and built for modern teams.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {AUTH_BENEFITS.map((item) => (
              <div key={item.title} className="bg-card border-border rounded-2xl border p-5">
                <div className="flex items-center gap-3">
                  <span className="bg-primary/10 border-border flex size-9 items-center justify-center rounded-full border">
                    <item.icon className="text-foreground" />
                  </span>
                  <p className="text-foreground text-sm font-medium">{item.title}</p>
                </div>
                <p className="text-muted-foreground mt-3 text-sm">{item.desc}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            {TRUST_POINTS.map((item) => (
              <AppBadge key={item} variant="outline" className="text-muted-foreground">
                {item}
              </AppBadge>
            ))}
          </div>
        </div>

        <div className="animate-in fade-in slide-in-from-bottom-4 relative flex w-full max-w-lg items-center justify-center">
          <div
            inert={isSent || isTwoFactorRequired ? true : undefined}
            className={cn(
              "bg-card border-border relative flex w-full flex-col gap-6 rounded-[1.75rem] border p-6 transition-all duration-300 ease-out sm:p-8",
              isSent || isTwoFactorRequired
                ? "pointer-events-none absolute inset-0 scale-[0.98] opacity-0"
                : "relative scale-100 opacity-100"
            )}
          >
            <div className="flex items-center justify-between gap-3 lg:hidden">
              <Logo isInteractive={false} className="w-24" />
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-2">
                <h2 className="text-2xl font-semibold">Welcome back</h2>
                <p className="text-muted-foreground text-sm">
                  Choose your preferred way to sign in.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              {BUTTONS.map((item) => {
                const isLastUsed = lastLogin === item.provider;
                return (
                  <LoadingButton
                    key={item.provider}
                    disabled={disabled}
                    isLoading={loadingProvider === item.provider}
                    loadingText={t("login_loading")}
                    variant="outline"
                    onClick={() => void handleSignIn(item.provider)}
                    className="text-foreground border-border bg-background hover:bg-surface-hover relative w-full cursor-pointer rounded-2xl px-3 py-5 transition-colors"
                  >
                    <div className="flex w-full items-center justify-center gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex shrink-0 items-center justify-center">
                          <item.icon />
                        </span>
                        <span className="truncate text-sm font-medium">{item.text}</span>
                      </div>
                      {isLastUsed && (
                        <AppBadge className="absolute -top-2 -right-2 text-xs">Last used</AppBadge>
                      )}
                    </div>
                  </LoadingButton>
                );
              })}
              <LoadingButton
                disabled={disabled}
                type="button"
                isLoading={loadingProvider === "passkey"}
                loadingText="Verifying security key..."
                variant="outline"
                onClick={() => void handlePasskeySignIn()}
                className="text-foreground border-border bg-background hover:bg-surface-hover relative w-full cursor-pointer rounded-2xl px-3 py-5 transition-colors"
              >
                <div className="flex w-full items-center justify-center gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex shrink-0 items-center justify-center">
                      <Fingerprint className="text-muted-foreground size-4" />
                    </span>
                    <span className="truncate text-sm font-medium">Continue with Passkey</span>
                  </div>
                  {lastLogin === "passkey" && (
                    <AppBadge className="absolute -top-2 -right-2 text-xs">Last used</AppBadge>
                  )}
                </div>
              </LoadingButton>
            </div>

            <div className="relative w-full">
              <div className="absolute inset-0 flex items-center">
                <span className="border-border w-full border-t" />
              </div>
              <div className="relative flex justify-center text-[0.7rem] uppercase">
                <span className="text-muted-foreground bg-card px-3">{t("or_divider")}</span>
              </div>
            </div>

            <div className="bg-background border-border flex flex-col gap-4 rounded-[1.35rem] border p-5">
              <div className="flex flex-col gap-1">
                <p className="text-foreground text-sm font-medium">Work email</p>
                <p className="text-muted-foreground text-sm">
                  We will send a one-time sign-in link. No password, no friction.
                </p>
              </div>
              <Form {...form}>
                <form
                  onSubmit={(e) => void form.handleSubmit(onSubmit)(e)}
                  className="flex w-full flex-col gap-4"
                >
                  <FormField
                    name="email"
                    control={form.control}
                    render={({ field }) => (
                      <FormItem className="relative flex flex-col gap-2">
                        <FormLabel className="text-muted-foreground">Email</FormLabel>
                        <FormControl>
                          <Input
                            disabled={disabled}
                            autoComplete="email webauthn"
                            inputMode="email"
                            placeholder="doxynix@example.com"
                            className="h-12"
                            {...field}
                          />
                        </FormControl>
                        <div className="min-h-5 px-1">
                          <FormMessage className="animate-in fade-in slide-in-from-top-1 text-xs" />
                        </div>
                        {lastLogin === "magic-link" && (
                          <AppBadge className="absolute top-2 -right-2 text-xs">Last used</AppBadge>
                        )}
                      </FormItem>
                    )}
                  />
                  <LoadingButton
                    disabled={disabled}
                    type="submit"
                    isLoading={loadingProvider === "email" || isVerifying}
                    loadingText={isVerifying ? "Security check..." : t("login_loading")}
                    className="h-12 w-full cursor-pointer rounded-2xl"
                  >
                    {t("login_btn")}
                  </LoadingButton>
                </form>
              </Form>
            </div>

            <p className="text-muted-foreground text-center text-xs">
              {t("terms_agreement")}{" "}
              <Link
                href="/terms"
                className="text-foreground decoration-border-accent underline underline-offset-4 hover:no-underline"
              >
                {tCommon("terms_of_service")}
              </Link>{" "}
              {tCommon("and")}{" "}
              <Link
                href="/privacy"
                className="text-foreground decoration-border-accent underline underline-offset-4 hover:no-underline"
              >
                {tCommon("privacy_policy")}
              </Link>
            </p>
          </div>

          <div
            inert={!isTwoFactorRequired ? true : undefined}
            className={cn(
              "bg-card border-border relative flex w-full flex-col gap-6 rounded-[1.75rem] border p-6 text-center transition-all duration-300 ease-out sm:p-8",
              isTwoFactorRequired
                ? "relative scale-100 opacity-100"
                : "pointer-events-none absolute inset-0 scale-[0.98] opacity-0"
            )}
          >
            <div className="flex w-full items-center justify-between border-b pb-4">
              <div className="flex items-center gap-2">
                <div className="bg-primary/10 text-primary flex size-10 items-center justify-center rounded-full">
                  {isBackupMode ? <KeyRound size={20} /> : <ShieldCheck size={20} />}
                </div>
                <div className="text-left">
                  <h3 className="text-sm font-semibold">
                    {isBackupMode ? "Backup Recovery" : "Two-Factor Verification"}
                  </h3>
                  <p className="text-muted-foreground text-[11px]">
                    {isBackupMode ? "Use 8-char recovery code" : "Enter 6-digit TOTP code"}
                  </p>
                </div>
              </div>
              <AppButton size="icon" variant="ghost" onClick={() => void setTwoFactorParam(null)}>
                <X size={16} />
              </AppButton>
            </div>

            <form
              onSubmit={(e) => void handleTwoFactorVerify(e)}
              className="flex flex-col gap-4 py-2"
            >
              <Input
                disabled={isTwoFactorVerifying}
                value={twoFactorCode}
                maxLength={isBackupMode ? 10 : 6}
                placeholder={isBackupMode ? "XXXX-XXXX" : "000000"}
                onChange={(e) => setTwoFactorCode(e.target.value)}
                className="h-12 rounded-2xl text-center font-mono text-lg tracking-widest"
              />

              <LoadingButton
                disabled={
                  twoFactorCode.trim().length === 0 ||
                  isTwoFactorVerifying ||
                  twoFactorCode.trim().length < 6
                }
                type="submit"
                isLoading={isTwoFactorVerifying}
                loadingText="Verifying..."
                className="h-12 w-full cursor-pointer gap-2 rounded-2xl"
              >
                Verify <ArrowRight size={16} />
              </LoadingButton>

              <AppButton
                disabled={isTwoFactorVerifying}
                type="button"
                variant="link"
                onClick={() => {
                  setIsBackupMode(!isBackupMode);
                  setTwoFactorCode("");
                }}
                className="text-muted-foreground hover:text-foreground mx-auto text-xs"
              >
                {isBackupMode ? "Back to Authenticator App" : "Lost your device? Use Backup Code"}
              </AppButton>
            </form>
          </div>

          <div
            inert={!isSent ? true : undefined}
            className={cn(
              "bg-card border-border relative flex w-full flex-col items-center justify-center gap-4 rounded-[1.75rem] border p-8 text-center transition-all duration-300 ease-out",
              isSent
                ? "relative scale-100 opacity-100"
                : "pointer-events-none absolute inset-0 scale-[0.98] opacity-0"
            )}
          >
            <div className="mb-2 flex size-20 items-center justify-center rounded-full">
              <CheckCircle2 className="text-foreground size-16" />
            </div>
            <h2 className="text-2xl font-semibold">{t("check_email_title")}</h2>
            <p className="text-muted-foreground max-w-sm text-sm">
              {t("check_email_desc")}{" "}
              <span className="text-foreground font-semibold italic">
                {form.getValues("email")}
              </span>
            </p>
            <AppButton
              variant="outline"
              onClick={() => setIsSent(false)}
              className="mt-2 cursor-pointer"
            >
              {t("enter_different_email")}
            </AppButton>
          </div>
        </div>
      </div>
      <Turnstile
        ref={turnstileRef}
        options={turnstileOptions}
        siteKey={TURNSTILE_SITE_KEY}
        onError={onTurnstileError}
        onExpire={onTurnstileExpire}
        onSuccess={onTurnstileSuccess}
        className={cn("mx-auto mt-2", (isSent || isTwoFactorRequired) && "hidden")}
      />
    </section>
  );
}
