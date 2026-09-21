"use client";

import { MoveLeft } from "lucide-react";
import { useTranslations } from "next-intl";

import { Link, usePathname } from "@/shared/i18n/navigation";
import { AppButton } from "@/shared/ui/core/button";

export function PublicHeaderCtaSlot() {
  const tCommon = useTranslations("Common");
  const pathname = usePathname();

  if (pathname.includes("/auth")) {
    return (
      <AppButton
        asChild
        variant="outline"
      >
        <Link href="/">
          <MoveLeft size={16} />
          {tCommon("back_home")}
        </Link>
      </AppButton>
    );
  }

  return (
    <AppButton
      asChild
      variant="outline"
    >
      <Link href="/auth">
        {tCommon("get_started")}
        <MoveLeft
          className="rotate-180"
          size={16}
        />
      </Link>
    </AppButton>
  );
}
