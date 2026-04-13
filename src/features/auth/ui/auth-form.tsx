"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import { CheckCircle2, ShieldCheck, Sparkles } from "lucide-react";
import { signIn } from "next-auth/react";
import { useTranslations } from "next-intl";
import posthog from "posthog-js";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod/v4-mini";

import { TURNSTILE_SITE_KEY } from "@/shared/constants/env.client";
import { setClientCookie } from "@/shared/lib/browser/cookies";
import { cn } from "@/shared/lib/cn";
import { Badge } from "@/shared/ui/core/badge";
import { Button } from "@/shared/ui/core/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/shared/ui/core/form";
import { Input } from "@/shared/ui/core/input";
import { GitHubIcon } from "@/shared/ui/icons/github-icon";
import { GoogleIcon } from "@/shared/ui/icons/google-icon";
import { Logo } from "@/shared/ui/icons/logo";
import { YandexIcon } from "@/shared/ui/icons/yandex-icon";
import { LoadingButton } from "@/shared/ui/kit/loading-button";
import { Link } from "@/i18n/routing";

const MagicLinkSchema = z.object({
  email: z
    .string()
    .check(
      z.email("Please enter a valid email address"),
      z.maxLength(254, "Email address cannot exceed 254 characters")
    ),
});

type AuthProvider = {
  icon: React.ComponentType<{ className?: string }>;
  provider: "github" | "google" | "yandex";
  text: string;
};

const BUTTONS = [
  { icon: GitHubIcon, provider: "github", text: "Continue with GitHub" },
  { icon: GoogleIcon, provider: "google", text: "Continue with Google" },
  { icon: YandexIcon, provider: "yandex", text: "Continue with Yandex" },
] as const satisfies readonly AuthProvider[];

type AuthBenefit = {
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
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
  const tCommon = useTranslations("Common");
  const t = useTranslations("Auth");
  const turnstileRef = useRef<TurnstileInstance>(null);
  const [turnstileToken, setTurnstileToken] = useState<null | string>(null);

  const [isSent, setIsSent] = useState(false);
  const [errorMessage, setErrorMessage] = useState<null | string>(null);
  const [loadingProvider, setLoadingProvider] = useState<null | string>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [pendingData, setPendingData] = useState<null | z.infer<typeof MagicLinkSchema>>(null);

  const form = useForm<z.infer<typeof MagicLinkSchema>>({
    defaultValues: { email: "" },
    resolver: zodResolver(MagicLinkSchema),
  });

  const disabled = loadingProvider != null || isVerifying;

  useEffect(() => {
    if (errorMessage != null) {
      toast.error(errorMessage);
    }
  }, [errorMessage]);

  const proceedWithSignIn = useCallback(
    async (values: z.infer<typeof MagicLinkSchema>, token: string) => {
      setIsVerifying(false);
      setLoadingProvider("email");

      setClientCookie("cf-turnstile-response", token, 300);

      try {
        const res = await signIn("email", {
          callbackUrl: "/dashboard",
          email: values.email,
          redirect: false,
        });

        if ((res?.ok ?? false) && res?.error == null) {
          setIsSent(true);
          toast.success(t("sent_toast_success"));
          posthog.capture("sign_in_email_sent", { provider: "email" });
        } else {
          if (res?.status === 403) {
            setErrorMessage("Captcha validation failed. Are you a robot?");
          } else {
            setErrorMessage(t("sent_toast_error"));
          }
          turnstileRef.current?.reset();
          setTurnstileToken(null);
        }
      } catch {
        setErrorMessage("Something went wrong. Please try again.");
        turnstileRef.current?.reset();
      } finally {
        setLoadingProvider(null);
        setPendingData(null);
        setTurnstileToken(null);
      }
    },
    [t]
  );

  const onSubmit = async (values: z.infer<typeof MagicLinkSchema>) => {
    setErrorMessage(null);

    if (turnstileToken != null) {
      await proceedWithSignIn(values, turnstileToken);
      return;
    }

    setIsVerifying(true);
    setPendingData(values);

    if (turnstileRef.current == null) {
      setIsVerifying(false);
      setPendingData(null);
      setErrorMessage("Security widget is not available. Please refresh the page.");
      return;
    }

    turnstileRef.current.reset();
  };

  async function handleSignIn(provider: string) {
    try {
      setLoadingProvider(provider);
      posthog.capture("sign_in_attempted", { provider });
      await signIn(provider, { callbackUrl: "/dashboard" });
    } finally {
      setLoadingProvider(null);
    }
  }

  useEffect(() => {
    if (isVerifying && pendingData && turnstileToken != null) {
      void proceedWithSignIn(pendingData, turnstileToken);
    }
  }, [isVerifying, pendingData, turnstileToken, proceedWithSignIn]);

  const onTurnstileSuccess = useCallback((token: string) => {
    setTurnstileToken(token);
  }, []);

  const onTurnstileError = useCallback(() => {
    setTurnstileToken(null);
    setIsVerifying(false);
    setPendingData(null);
    setErrorMessage("Verification service error. Please try again.");
  }, []);

  const onTurnstileExpire = useCallback(() => {
    if (isSent || loadingProvider === "email") return;

    setTurnstileToken(null);
    setIsVerifying(false);
    setPendingData(null);
    setErrorMessage("Verification expired. Please try again.");
  }, [isSent, loadingProvider]);

  const turnstileOptions = {
    action: "auth",
    size: "invisible" as const,
    theme: "dark" as const,
  };

  return (
    <section className="relative container mx-auto flex min-h-[calc(100dvh-3rem)] items-center justify-center overflow-hidden px-4">
      <div className="flex w-full items-center justify-center gap-10">
        <div
          inert={isSent ? true : undefined}
          className={cn(
            "hidden max-w-2xl flex-col gap-8 lg:flex",
            isSent
              ? "pointer-events-none absolute inset-0 scale-[0.98] opacity-0"
              : "relative scale-100 opacity-100"
          )}
        >
          <div className="flex items-center gap-3">
            <Logo isInteractive={false} className="w-xl" />
          </div>

          <div className="space-y-5">
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
              <div key={item.title} className="bg-card/70 border-border/70 rounded-2xl border p-5">
                <div className="flex items-center gap-3">
                  <span className="bg-primary/10 border-border/70 flex size-9 items-center justify-center rounded-full border">
                    <item.icon className="text-foreground size-4" />
                  </span>
                  <p className="text-foreground text-sm font-medium">{item.title}</p>
                </div>
                <p className="text-muted-foreground mt-3 text-sm">{item.desc}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            {TRUST_POINTS.map((item) => (
              <Badge key={item} variant="outline" className="text-muted-foreground">
                {item}
              </Badge>
            ))}
          </div>
        </div>

        <div className="animate-in fade-in slide-in-from-bottom-4 relative flex w-full max-w-lg items-center justify-center">
          <div
            inert={isSent ? true : undefined}
            className={cn(
              "bg-card/80 border-border/80 relative flex w-full flex-col gap-6 rounded-[1.75rem] border p-6 transition-all ease-out sm:p-8",
              isSent
                ? "pointer-events-none absolute inset-0 scale-[0.98] opacity-0"
                : "relative scale-100 opacity-100"
            )}
          >
            <div className="flex items-center justify-between gap-3 lg:hidden">
              <Logo isInteractive={false} className="w-24" />
            </div>

            <div className="space-y-3">
              <div className="space-y-2">
                <h2 className="text-2xl font-semibold">Welcome back</h2>
                <p className="text-muted-foreground text-sm">
                  Choose your preferred way to sign in.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              {BUTTONS.map((item) => (
                <LoadingButton
                  key={item.provider}
                  disabled={disabled}
                  isLoading={loadingProvider === item.provider}
                  loadingText={t("login_loading")}
                  variant="outline"
                  onClick={() => void handleSignIn(item.provider)}
                  className="text-foreground border-border/80 bg-background/60 hover:bg-surface-hover w-full cursor-pointer rounded-2xl px-3 py-5"
                >
                  <div className="flex w-full items-center justify-center gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex shrink-0 items-center justify-center">
                        <item.icon />
                      </span>
                      <span className="truncate text-sm font-medium">{item.text}</span>
                    </div>
                  </div>
                </LoadingButton>
              ))}
            </div>

            <div className="relative w-full">
              <div className="absolute inset-0 flex items-center">
                <span className="border-border/80 w-full border-t" />
              </div>
              <div className="relative flex justify-center text-[0.7rem] uppercase">
                <span className="text-muted-foreground bg-card px-3">{t("or_divider")}</span>
              </div>
            </div>

            <div className="bg-background/40 border-border/70 flex flex-col gap-4 rounded-[1.35rem] border p-5">
              <div className="space-y-1">
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
                      <FormItem className="flex flex-col gap-2">
                        <FormLabel className="text-muted-foreground">Email</FormLabel>
                        <FormControl>
                          <Input
                            autoComplete="email"
                            disabled={disabled}
                            inputMode="email"
                            placeholder="doxynix@example.com"
                            className="h-12"
                            {...field}
                          />
                        </FormControl>
                        <div className="min-h-5 px-1">
                          <FormMessage className="animate-in fade-in slide-in-from-top-1 text-xs" />
                        </div>
                      </FormItem>
                    )}
                  />
                  <LoadingButton
                    type="submit"
                    disabled={disabled}
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
            inert={!isSent ? true : undefined}
            className={cn(
              "bg-card/80 border-border/80 relative flex w-full flex-col items-center justify-center gap-4 rounded-[1.75rem] border p-8 text-center transition-all ease-out",
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
            <Button
              variant="outline"
              onClick={() => setIsSent(false)}
              className="mt-2 cursor-pointer"
            >
              {t("enter_different_email")}
            </Button>
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
        className={cn("mx-auto mt-2", isSent && "hidden")}
      />
    </section>
  );
}
