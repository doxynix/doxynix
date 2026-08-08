"use client";

import { MoveLeft } from "lucide-react";

import { Link, usePathname } from "@/shared/i18n/routing";
import { AppButton } from "@/shared/ui/core/button";

export function PublicHeaderCtaSlot() {
  const pathname = usePathname();

  if (pathname.includes("/auth")) {
    return (
      <AppButton asChild variant="outline">
        <Link href="/">
          <MoveLeft size={16} />
          Back Home
        </Link>
      </AppButton>
    );
  }

  return (
    <AppButton asChild variant="outline">
      <Link href="/auth">
        Get Started
        <MoveLeft size={16} className="rotate-180" />
      </Link>
    </AppButton>
  );
}
