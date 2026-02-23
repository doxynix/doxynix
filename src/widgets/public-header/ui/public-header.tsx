import type { Route } from "next";
import { Menu, MoveLeft } from "lucide-react";
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
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            </Button>
          ))}
        </nav>
        <div className="flex items-center gap-4">
          <AppTooltip content="Work in Progress">
            <span className="text-warning bg-warning/20 rounded p-1 py-0.5 text-xs">BETA</span>
          </AppTooltip>
          <Button asChild variant="outline">
            <Link href="/auth">
              Get Started
              <MoveLeft size={16} className="rotate-180" />
            </Link>
          </Button>
          {/* <ThemeToggle className="text-muted-foreground" /> // THEME: на время!*/}
          <div className="flex items-center gap-2 md:hidden">
            <Sheet>
              <SheetTrigger asChild>
                <Button size="icon" variant="ghost">
                  <Menu className="h-5 w-5" />
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
                            <item.icon className="h-4 w-4" />
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
