"use client";

import { useEffect } from "react";
import { LogIn, ShieldAlert } from "lucide-react";
import { useTranslations } from "next-intl";

import { Link } from "@/shared/i18n/navigation";
import { authClient } from "@/shared/lib/auth-client";
import { AppButton } from "@/shared/ui/core/button";

export default function UnauthorizedPage() {
  const tCommon = useTranslations("Common");
  const t = useTranslations("Error");
  useEffect(() => {
    void authClient.signOut();
  }, []);

  return (
    <div className="flex h-dvh w-full flex-col items-center justify-center bg-background">
      <div className="flex max-w-md flex-col items-center gap-6 text-center">
        <div className="flex size-20 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <ShieldAlert size={40} />
        </div>
        <h1 className="font-bold text-3xl tracking-tight">{t("session_expired_title")}</h1>
        <p className="text-muted-foreground">{t("session_expired_desc")}</p>
        <AppButton
          asChild
          className="gap-2"
        >
          <Link href="/auth">
            <LogIn size={18} /> {tCommon("login_btn")}
          </Link>
        </AppButton>
      </div>
    </div>
  );
}
