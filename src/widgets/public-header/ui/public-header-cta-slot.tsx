"use client";

import { MoveLeft } from "lucide-react";

import { Button } from "@/shared/ui/core/button";
import { Link, usePathname } from "@/i18n/routing";

export function PublicHeaderCtaSlot() {
  const pathname = usePathname();

  if (pathname.includes("/auth")) {
    return (
      <Button asChild variant="outline">
        <Link href="/">
          <MoveLeft size={16} />
          Back Home
        </Link>
      </Button>
    );
  }

  return (
    <Button asChild variant="outline">
      <Link href="/auth">
        Get Started
        <MoveLeft size={16} className="rotate-180" />
      </Link>
    </Button>
  );
}
