import type { Route } from "next";
import { Menu } from "lucide-react";
import { useTranslations } from "next-intl";

import { publicHeaderMenu } from "@/shared/constants/navigation";
import { Button } from "@/shared/ui/core/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/shared/ui/core/sheet";
import { Logo } from "@/shared/ui/icons/logo";
import { AppTooltip } from "@/shared/ui/kit/app-tooltip";
import { Link } from "@/i18n/routing";

import { PublicHeaderCtaSlot } from "./public-header-cta-slot";

export function PublicHeader() {
  const t = useTranslations("Common");

  return (
    <header className="w-full">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <Logo className="w-20" />
        </div>

        <nav className="hidden gap-4 md:flex">
          {publicHeaderMenu.map((item) => (
            <Button key={item.href} asChild variant="ghost">
              <Link href={item.href as Route} className="flex items-center gap-2">
                <item.icon className="size-4" />
                {item.label}
              </Link>
            </Button>
          ))}
        </nav>
        <div className="flex items-center gap-4">
          <AppTooltip content="Work in Progress">
            <span className="text-warning bg-warning/20 rounded p-1 py-0.5 text-xs">BETA</span>
          </AppTooltip>
          <PublicHeaderCtaSlot />
          <div className="flex items-center gap-2 md:hidden">
            <Sheet>
              <SheetTrigger asChild>
                <Button size="icon" variant="ghost">
                  <Menu className="size-5" />
                  <span className="sr-only">{t("open_menu")}</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-1/2">
                <SheetHeader>
                  <SheetTitle className="text-left">{t("menu")}</SheetTitle>
                </SheetHeader>

                <div className="mt-8 flex flex-col gap-4">
                  <nav className="flex flex-col gap-2">
                    {publicHeaderMenu.map((item) => (
                      <SheetClose key={item.href} asChild>
                        <Button asChild variant="ghost" className="justify-start">
                          <Link href={item.href as Route} className="flex items-center gap-2">
                            <item.icon className="size-4" />
                            {item.label}
                          </Link>
                        </Button>
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
