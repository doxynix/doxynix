"use client";

import { useEffect, useRef, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import { Mail } from "lucide-react";
import { signIn } from "next-auth/react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { cn } from "@/shared/lib/utils";
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
    .email({ message: "Please enter a valid email address" })
    .max(254, "Email address cannot exceed 254 characters"),
});

const BUTTONS = [
  { provider: "github", icon: GitHubIcon, text: "Github" },
  { provider: "google", icon: GoogleIcon, text: "Google" },
  { provider: "yandex", icon: YandexIcon, text: "Yandex" },
];

export function AuthForm() {
  const tCommon = useTranslations("Common");
  const t = useTranslations("Auth");
  const turnstileRef = useRef<TurnstileInstance>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);

  const [isSent, setIsSent] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loadingProvider, setLoadingProvider] = useState<string | null>(null);

  const form = useForm<z.infer<typeof MagicLinkSchema>>({
    resolver: zodResolver(MagicLinkSchema),
    defaultValues: { email: "" },
  });

  const disabled = loadingProvider !== null;

  useEffect(() => {
    if (errorMessage != null) {
      toast.error(errorMessage);
    }
  }, [errorMessage]);

  const onSubmit = async (values: z.infer<typeof MagicLinkSchema>) => {
    setErrorMessage(null);
    setLoadingProvider("email");
    const token = turnstileToken;
    if (token === null) {
      turnstileRef.current?.reset();
      toast.error("Security check failed. Please try again.");
      setLoadingProvider(null);
      return;
    }

    document.cookie = `cf-turnstile-response=${token}; path=/; max-age=120`;

    try {
      const res = await signIn("email", {
        email: values.email,
        redirect: false,
        callbackUrl: "/dashboard",
      });

      if ((res?.ok ?? false) && res?.error == null) {
        setIsSent(true);
        toast.success(t("sent_toast_success"));
      } else {
        if (res?.status === 403) {
          setErrorMessage("Captcha validation failed. Are you a robot?");
        } else {
          setErrorMessage(t("sent_toast_error"));
        }
        turnstileRef.current?.reset();
        setTurnstileToken(null);
      }
    } finally {
      setLoadingProvider(null);
    }
  };

  async function handleSignIn(provider: string) {
    try {
      setLoadingProvider(provider);
      await signIn(provider, { callbackUrl: "/dashboard" });
    } finally {
      setLoadingProvider(null);
    }
  }

  return (
    <div className="relative flex w-full max-w-lg items-center justify-center overflow-hidden">
      <div className="fixed -top-10 left-0">
        <Turnstile
          ref={turnstileRef}
          siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY!}
          options={{
            action: "auth",
            size: "invisible",
          }}
          onSuccess={(token) => setTurnstileToken(token)}
          onError={() => setTurnstileToken(null)}
          onExpire={() => setTurnstileToken(null)}
        />
      </div>
      <div
        className={cn(
          "flex max-w-lg flex-col items-center justify-center gap-6 transition-all ease-out",
          isSent
            ? "pointer-events-none absolute inset-0 scale-95 opacity-0"
            : "relative scale-100 opacity-100"
        )}
      >
        <Logo isInteractive={false} />
        <div className="mt-2 flex flex-wrap items-center justify-center gap-4 sm:mt-16">
          {BUTTONS.map((item) => (
            <LoadingButton
              key={item.provider}
              className="cursor-pointer"
              isLoading={loadingProvider === item.provider}
              loadingText={t("login_loading")}
              disabled={disabled}
              onClick={() => handleSignIn(item.provider)}
            >
              <item.icon /> {item.text}
            </LoadingButton>
          ))}
        </div>
        <div className="relative w-full">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="text-muted-foreground bg-background px-2">{t("or_divider")}</span>
          </div>
        </div>
        <div className="bg-muted-foreground/5 flex flex-col gap-4 rounded-xl p-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex w-full flex-col gap-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem className="flex flex-col gap-2">
                    <FormLabel className="text-muted-foreground">Email</FormLabel>
                    <FormControl>
                      <Input
                        disabled={disabled}
                        className="h-12"
                        placeholder="doxynix@example.com"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <LoadingButton
                type="submit"
                className="cursor-pointer"
                isLoading={loadingProvider === "email"}
                loadingText={t("login_loading")}
                disabled={disabled}
              >
                {t("login_btn")}
              </LoadingButton>
            </form>
          </Form>
          <p className="text-muted-foreground text-center text-xs">
            {t("terms_agreement")}{" "}
            <Link className="underline hover:no-underline" href="/terms">
              {tCommon("terms_of_service")}
            </Link>{" "}
            {tCommon("and")}{" "}
            <Link className="underline hover:no-underline" href="/privacy">
              {tCommon("privacy_policy")}
            </Link>
          </p>
        </div>
      </div>
      <div
        className={cn(
          "flex flex-col items-center justify-center gap-4 text-center transition-all ease-out",
          isSent
            ? "relative scale-100 opacity-100"
            : "pointer-events-none absolute inset-0 scale-95 opacity-0"
        )}
      >
        <div className="bg-muted-foreground/10 mb-4 flex size-24 items-center justify-center rounded-full">
          <Mail className="text-muted-foreground size-12" />
        </div>
        <h2 className="text-xl font-bold">{t("check_email_title")}</h2>
        <p className="text-muted-foreground">
          {t("check_email_desc")}{" "}
          <span className="text-foreground font-bold italic">{form.getValues("email")}</span>
        </p>
        <Button className="cursor-pointer" variant="outline" onClick={() => setIsSent(false)}>
          {t("enter_different_email")}
        </Button>
      </div>
    </div>
  );
}
