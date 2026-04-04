"use client";

import { useEffect } from "react";
import { LogIn, ShieldAlert } from "lucide-react";
import { signOut } from "next-auth/react";

import { Button } from "@/shared/ui/core/button";
import { Link } from "@/i18n/routing";

export default function UnauthorizedPage() {
  useEffect(() => {
    void signOut({ redirect: false });
  }, []);

  return (
    <div className="bg-background flex h-dvh w-full flex-col items-center justify-center">
      <div className="flex max-w-md flex-col items-center space-y-6 text-center">
        <div className="bg-destructive/10 text-destructive flex size-20 items-center justify-center rounded-full">
          <ShieldAlert size={40} />
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Your session has expired</h1>
        <p className="text-muted-foreground">
          It seems you have logged out on another device or your session has expired. Please log in
          again.
        </p>
        <Button asChild className="gap-2">
          <Link href="/auth">
            <LogIn size={18} /> Log in
          </Link>
        </Button>
      </div>
    </div>
  );
}
