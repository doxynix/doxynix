"use client";

import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { signIn } from "next-auth/react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/shared/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/shared/ui/form";
import GithubIcon from "@/shared/ui/github-icon";
import { GoogleIcon } from "@/shared/ui/google-icon";
import { Input } from "@/shared/ui/input";
import { YandexIcon } from "@/shared/ui/yandex-icon";

const MagicLinkSchema = z.object({
  email: z.email({ message: "Введите корректный email" }),
});

export function AuthCard() {
  const [isSent, setIsSent] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const form = useForm<z.infer<typeof MagicLinkSchema>>({
    resolver: zodResolver(MagicLinkSchema),
    defaultValues: { email: "" },
  });

  useEffect(() => {
    if (errorMessage != null) {
      toast.error(errorMessage);
    }
  }, [errorMessage]);

  const onSubmit = async (values: z.infer<typeof MagicLinkSchema>) => {
    setErrorMessage(null);
    const res = await signIn("email", {
      email: values.email,
      redirect: false,
      callbackUrl: "/dashboard",
    });

    if ((res?.ok ?? false) && res?.error == null) {
      setIsSent(true);
    } else {
      setErrorMessage("Ошибка отправки письма. Попробуйте ещё раз.");
    }
  };

  if (isSent) {
    return (
      <div className="space-y-4 text-center">
        <h2 className="text-xl font-bold">Проверьте почту.</h2>
        <p className="text-muted-foreground">
          Мы отправили ссылку на <b className="italic">{form.getValues("email")}</b>.
        </p>
        <Button variant="outline" onClick={() => setIsSent(false)}>
          Ввести другой Email
        </Button>
      </div>
    );
  }

  return (
    <div className="flex max-w-md flex-col items-center justify-center gap-6">
      <div className="flex items-center justify-center gap-4">
        <Button className="cursor-pointer" onClick={() => signIn("github")}>
          <GithubIcon /> GitHub
        </Button>
        <Button className="cursor-pointer" onClick={() => signIn("google")}>
          <GoogleIcon /> Google
        </Button>
        <Button className="cursor-pointer" onClick={() => signIn("yandex")}>
          <YandexIcon /> Yandex
        </Button>
      </div>
      <div className="relative w-full">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background text-muted-foreground px-2">или</span>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Введите Email</FormLabel>
                <FormControl>
                  <Input placeholder="example@gmail.com" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" className="w-full cursor-pointer">
            Войти по Email
          </Button>
        </form>
      </Form>
    </div>
  );
}
