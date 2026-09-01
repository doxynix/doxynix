import { useId, useState } from "react";
import { type AuthSchema, authSchema } from "@doxynix/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";

import { authClient } from "@/shared/lib/auth-client";
import { Button } from "@/shared/ui/core/button";
import { Input } from "@/shared/ui/core/input";
import { Label } from "@/shared/ui/core/label";

export function AuthForm() {
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);
  const emailId = useId();
  const passwordId = useId();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<AuthSchema>({
    defaultValues: {
      email: "",
      password: "",
    },
    resolver: zodResolver(authSchema),
  });

  const onSubmit = async (values: AuthSchema) => {
    setServerError(null);

    const { error } = await authClient.signIn.email({
      email: values.email,
      password: values.password,
    });

    if (error != null) {
      setServerError(error.message ?? "Incorrect username or password");
      return;
    }

    void navigate({ to: "/" });
  };

  return (
    <div className="w-full max-w-md space-y-6 rounded-xl border border-zinc-800 bg-zinc-900 p-8 text-white shadow-2xl">
      <div className="space-y-2 text-center">
        <h1 className="font-bold text-2xl tracking-tight">Doxynix SIEM System</h1>
      </div>

      {serverError && (
        <div className="rounded-md border border-red-800 bg-red-950/50 p-3 font-mono text-red-400 text-xs">
          {serverError}
        </div>
      )}

      <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
        <div className="space-y-1">
          <Label className="font-mono text-xs text-zinc-300" htmlFor={emailId}>
            EMAIL
          </Label>
          <Input
            id={emailId}
            placeholder="analyst@siem.local"
            type="email"
            {...register("email")}
          />
          {errors.email && <p className="text-red-500 text-xs">{errors.email.message}</p>}
        </div>

        <div className="space-y-1">
          <Label className="font-mono text-xs text-zinc-300" htmlFor={passwordId}>
            PASSWORD
          </Label>
          <Input id={passwordId} placeholder="••••••••" type="password" {...register("password")} />
          {errors.password && <p className="text-red-500 text-xs">{errors.password.message}</p>}
        </div>

        <Button disabled={isSubmitting} type="submit">
          {isSubmitting ? (
            <div className="size-5 animate-spin rounded-full border-2 border-black border-t-transparent" />
          ) : (
            "Log In"
          )}
        </Button>
      </form>
    </div>
  );
}
