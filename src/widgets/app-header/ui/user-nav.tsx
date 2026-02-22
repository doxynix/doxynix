"use client";

import { useState } from "react";
import type { Route } from "next";
import { LogOut } from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import { useTranslations } from "next-intl";

import { userNavMenu } from "@/shared/constants/navigation";
import { getInitials } from "@/shared/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/ui/core/avatar";
import { Button } from "@/shared/ui/core/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/ui/core/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/shared/ui/core/dropdown-menu";
import { Skeleton } from "@/shared/ui/core/skeleton";
import { LoadingButton } from "@/shared/ui/kit/loading-button";

import { Link } from "@/i18n/routing";

export function UserNav() {
  const { data: session, status } = useSession();
  const user = session?.user;
  const tCommon = useTranslations("Common");
  const t = useTranslations("Auth");

  const avatar = user?.image;
  const name = user?.name;
  const email = user?.email;
  const [loading, setLoading] = useState(false);

  async function handleSignOut() {
    try {
      setLoading(true);
      await signOut({ callbackUrl: "/auth" });
    } finally {
      setLoading(false);
    }
  }

  if (status === "loading") {
    return <Skeleton className="h-9 w-9 rounded-full" />;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <div className="flex cursor-pointer items-center gap-3">
          <Avatar className="h-9 w-9">
            <AvatarImage alt={name ?? "User"} src={avatar ?? undefined} className="object-cover" />
            <AvatarFallback className="text-xs">{getInitials(name, email)}</AvatarFallback>
          </Avatar>
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="truncate text-sm font-medium">{name}</p>
            <p className="text-muted-foreground truncate text-xs">{email}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          {userNavMenu.map((item) => (
            <DropdownMenuItem key={item.href} asChild className="group">
              <Link href={item.href as Route} className="flex items-center">
                <item.icon />
                <span>{item.label}</span>
                {item.shortcut != null && (
                  <DropdownMenuShortcut className="opacity-0 transition-opacity group-hover:opacity-100">
                    {item.shortcut}
                  </DropdownMenuShortcut>
                )}
              </Link>
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />

        <Dialog>
          <DialogTrigger asChild>
            <DropdownMenuItem
              onSelect={(e) => e.preventDefault()}
              className="text-destructive focus:bg-destructive/20 focus:text-destructive"
            >
              <LogOut className="text-destructive mr-2" />
              {t("logout")}
            </DropdownMenuItem>
          </DialogTrigger>

          <DialogContent className="sm:max-w-105">
            <DialogHeader>
              <DialogTitle>{t("logout_title")}</DialogTitle>
              <DialogDescription>{t("logout_confirmation_desc")}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex justify-end gap-2">
                <DialogClose asChild>
                  <Button disabled={loading} variant="outline" className="cursor-pointer">
                    {tCommon("cancel")}
                  </Button>
                </DialogClose>
                <LoadingButton
                  disabled={loading}
                  isLoading={loading}
                  loadingText="Logout..."
                  variant="destructive"
                  onClick={() => void handleSignOut()}
                  className="cursor-pointer"
                >
                  {t("logout")}
                </LoadingButton>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
