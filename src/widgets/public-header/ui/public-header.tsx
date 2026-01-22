import { Suspense } from "react";
import type { Route } from "next";
import Link from "next/link";
import { Menu } from "lucide-react";

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
import { Skeleton } from "@/shared/ui/core/skeleton";
import { Logo } from "@/shared/ui/icons/logo";

import { HeaderAuthButton } from "./public-header-auth-button";

export function PublicHeader() {
  return (
    <header className="w-full">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <Logo className="w-20" />
        </div>

        <nav className="hidden gap-4 md:flex">
          {publicHeaderMenu.map((item) => (
            <Button key={item.href} variant="ghost" asChild>
              <Link href={item.href as Route} className="flex items-center gap-2">
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            </Button>
          ))}
        </nav>
        <div className="flex items-center gap-4">
          <Suspense fallback={<Skeleton className="h-9 w-31" />}>
            <HeaderAuthButton />
          </Suspense>
          {/* <ThemeToggle className="text-muted-foreground" /> // THEME: на время!*/}
          <div className="flex items-center gap-2 md:hidden">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Open menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-1/2">
                <SheetHeader>
                  <SheetTitle className="text-left">Menu</SheetTitle>
                </SheetHeader>

                <div className="mt-8 flex flex-col gap-4">
                  <nav className="flex flex-col gap-2">
                    {publicHeaderMenu.map((item) => (
                      <SheetClose asChild key={item.href}>
                        <Button variant="ghost" className="justify-start" asChild>
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
