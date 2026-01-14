"use client";

import { useState } from "react";
import { Route } from "next";
import Link from "next/link";
import { LogOut } from "lucide-react";
import { User } from "next-auth";
import { signOut } from "next-auth/react";

import { userNavMenu } from "@/shared/constants/navigation";
import { getInitials } from "@/shared/lib/getInititals";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/ui/avatar";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { LoadingButton } from "@/shared/ui/LoadingButton";

type Props = {
  user: User;
};

export function UserNav({ user }: Props) {
  const avatar = user?.image;
  const name = user?.name;
  const email = user?.email;
  const [loading, setLoading] = useState(false);

  async function handleSignOut() {
    try {
      setLoading(true);
      await signOut();
    } finally {
      setLoading(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <div className="flex cursor-pointer items-center gap-3">
          <Avatar className="h-9 w-9">
            <AvatarImage src={avatar ?? undefined} alt={name ?? "User"} className="object-cover" />
            <AvatarFallback className="text-xs">{getInitials(name, email)}</AvatarFallback>
          </Avatar>
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="truncate text-sm leading-none font-medium">{name}</p>
            <p className="text-muted-foreground truncate text-xs leading-none">{email}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          {userNavMenu
            .filter((item) => item.label !== "Опасная зона")
            .map((item) => (
              <DropdownMenuItem key={item.href} asChild>
                <Link href={item.href as Route} className="flex cursor-pointer items-center">
                  {item.icon && <item.icon />}
                  <span>{item.label}</span>
                  {item.shortcut !== null && (
                    <DropdownMenuShortcut>{item.shortcut}</DropdownMenuShortcut>
                  )}
                </Link>
              </DropdownMenuItem>
            ))}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />

        <div className="">
          <Dialog>
            <DialogTrigger asChild>
              <DropdownMenuItem
                className="text-destructive focus:bg-destructive/20 focus:text-destructive cursor-pointer"
                onSelect={(e) => e.preventDefault()}
              >
                <LogOut className="text-destructive mr-2" />
                Выйти
              </DropdownMenuItem>
            </DialogTrigger>

            <DialogContent className="sm:max-w-105">
              <DialogHeader>
                <DialogTitle>Выход из аккаунта</DialogTitle>
                <DialogDescription>Вы уверены что хотите выйти из аккаунта?</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="flex justify-end gap-2">
                  <DialogClose asChild>
                    <Button className="cursor-pointer" variant="outline" disabled={loading}>
                      Отмена
                    </Button>
                  </DialogClose>
                  <LoadingButton
                    variant="destructive"
                    disabled={loading}
                    className="cursor-pointer"
                    onClick={handleSignOut}
                    isLoading={loading}
                    loadingText="Выход..."
                  >
                    Выйти
                  </LoadingButton>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
