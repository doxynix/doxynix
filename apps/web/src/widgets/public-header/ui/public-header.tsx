import type { Route } from "next";
import { Menu } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { publicHeaderMenu } from "@/shared/constants/navigation";
import { Link } from "@/shared/i18n/navigation";
import { Logo } from "@/shared/ui/branding/doxynix-logo";
import { AppButton } from "@/shared/ui/core/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/shared/ui/core/sheet";
import { AppTooltip } from "@/shared/ui/kit/app-tooltip";

import { PublicHeaderCtaSlot } from "./public-header-cta-slot";

export async function PublicHeader() {
  const t = await getTranslations("Common");

  return (
    <header className="w-full">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <Logo className="w-20" />
        </div>

        <nav className="hidden gap-4 md:flex">
          {publicHeaderMenu.map((item) => (
            <AppButton asChild key={item.href} variant="ghost">
              <Link className="flex items-center gap-2" href={item.href as Route}>
                {item.icon != null && <item.icon />}
                {item.label}
              </Link>
            </AppButton>
          ))}
        </nav>
        <div className="flex items-center gap-4">
          <AppTooltip content="Work in Progress">
            <span className="rounded bg-warning/20 p-1 py-0.5 text-warning text-xs">BETA</span>
          </AppTooltip>
          <PublicHeaderCtaSlot />
          <div className="flex items-center gap-2 md:hidden">
            <Sheet>
              <SheetTrigger asChild>
                <AppButton size="icon" variant="ghost">
                  <Menu className="size-5" />
                  <span className="sr-only">{t("open_menu")}</span>
                </AppButton>
              </SheetTrigger>
              <SheetContent className="w-1/2" side="right">
                <SheetHeader>
                  <SheetTitle className="text-left">{t("menu")}</SheetTitle>
                </SheetHeader>

                <div className="mt-8 flex flex-col gap-4">
                  <nav className="flex flex-col gap-2">
                    {publicHeaderMenu.map((item) => (
                      <SheetClose asChild key={item.href}>
                        <AppButton asChild className="justify-start" variant="ghost">
                          <Link className="flex items-center gap-2" href={item.href as Route}>
                            {item.icon != null && <item.icon />}
                            {item.label}
                          </Link>
                        </AppButton>
                      </SheetClose>
                    ))}
                  </nav>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  );
}
