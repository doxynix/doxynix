"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { Mail } from "lucide-react";
import { signIn } from "next-auth/react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/shared/ui/form";
import GithubIcon from "@/shared/ui/github-icon";
import { GoogleIcon } from "@/shared/ui/google-icon";
import { Input } from "@/shared/ui/input";
import { LoadingButton } from "@/shared/ui/LoadingButton";
import { Logo } from "@/shared/ui/Logo";
import { YandexIcon } from "@/shared/ui/yandex-icon";

const MagicLinkSchema = z.object({
  email: z
    .email({ message: "Please enter a valid email address" })
    .max(254, "Email address cannot exceed 254 characters"),
});

export function AuthForm() {
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
    try {
      const res = await signIn("email", {
        email: values.email,
        redirect: false,
        callbackUrl: "/dashboard",
      });

      if ((res?.ok ?? false) && res?.error == null) {
        setIsSent(true);
        toast.success("Email sent");
      } else {
        setErrorMessage("Error sending email. Please try again.");
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
          <LoadingButton
            className="cursor-pointer"
            isLoading={loadingProvider === "github"}
            loadingText="Login..."
            disabled={disabled}
            onClick={() => handleSignIn("github")}
          >
            <GithubIcon /> GitHub
          </LoadingButton>

          <LoadingButton
            className="cursor-pointer"
            isLoading={loadingProvider === "google"}
            loadingText="Login..."
            disabled={disabled}
            onClick={() => handleSignIn("google")}
          >
            <GoogleIcon /> Google
          </LoadingButton>

          <LoadingButton
            className="cursor-pointer"
            isLoading={loadingProvider === "yandex"}
            loadingText="Login..."
            disabled={disabled}
            onClick={() => handleSignIn("yandex")}
          >
            <YandexIcon /> Yandex
          </LoadingButton>
        </div>
        <div className="relative w-full">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="text-muted-foreground bg-background px-2">or</span>
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
                loadingText="Login..."
                disabled={disabled}
              >
                Log in
              </LoadingButton>
            </form>
          </Form>
          <p className="text-muted-foreground text-center text-xs">
            By creating an account, you agree to our{" "}
            <Link className="underline hover:no-underline" href="/terms">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link className="underline hover:no-underline" href="/privacy">
              Privacy Policy
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
        <h2 className="text-xl font-bold">Check your email</h2>
        <p className="text-muted-foreground">
          We sent a login link to{" "}
          <span className="text-foreground font-bold italic">{form.getValues("email")}</span>
        </p>
        <Button className="cursor-pointer" variant="outline" onClick={() => setIsSent(false)}>
          Enter different Email{" "}
        </Button>
      </div>
    </div>
  );
}
