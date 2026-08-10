import { type AuthSchema, authSchema } from "@doxynix/siem-shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { authClient } from "@/shared/lib/auth-client";
import { Button } from "@/shared/ui/core/button";
import { Input } from "@/shared/ui/core/input";
import { Label } from "@/shared/ui/core/label";

export function AuthForm() {
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<AuthSchema>({
    resolver: zodResolver(authSchema),
    defaultValues: {
      email: "",
      password: "",
    },
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

    navigate({ to: "/" });
  };

  return (
    <div className="w-full max-w-md p-8 space-y-6 bg-zinc-900 border border-zinc-800 rounded-xl text-white shadow-2xl">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-bold tracking-tight">Doxynix SIEM System</h1>
      </div>

      {serverError && (
        <div className="p-3 text-xs font-mono bg-red-950/50 border border-red-800 text-red-400 rounded-md">
          {serverError}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1">
          <Label className="text-xs font-mono text-zinc-300">EMAIL</Label>
          <Input {...register("email")} type="email" placeholder="analyst@siem.local" />
          {errors.email && <p className="text-xs text-red-500">{errors.email.message}</p>}
        </div>

        <div className="space-y-1">
          <Label className="text-xs font-mono text-zinc-300">PASSWORD</Label>
          <Input {...register("password")} type="password" placeholder="••••••••" />
          {errors.password && <p className="text-xs text-red-500">{errors.password.message}</p>}
        </div>

        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? (
            <div className="size-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
          ) : (
            "Log In"
          )}
        </Button>
      </form>
    </div>
  );
}
