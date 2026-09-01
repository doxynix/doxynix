"use client";

import { useEffect } from "react";
import { LogIn, ShieldAlert } from "lucide-react";

import { Link } from "@/shared/i18n/navigation";
import { authClient } from "@/shared/lib/auth-client";
import { AppButton } from "@/shared/ui/core/button";

export default function UnauthorizedPage() {
  useEffect(() => {
    void authClient.signOut();
  }, []);

  return (
    <div className="flex h-dvh w-full flex-col items-center justify-center bg-background">
      <div className="flex max-w-md flex-col items-center gap-6 text-center">
        <div className="flex size-20 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <ShieldAlert size={40} />
        </div>
        <h1 className="font-bold text-3xl tracking-tight">Your session has expired</h1>
        <p className="text-muted-foreground">
          It seems you have logged out on another device or your session has expired. Please log in
          again.
        </p>
        <AppButton asChild className="gap-2">
          <Link href="/auth">
            <LogIn size={18} /> Log in
          </Link>
        </AppButton>
      </div>
    </div>
  );
}
