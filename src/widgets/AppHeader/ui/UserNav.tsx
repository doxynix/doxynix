"use client";

import { useState } from "react";
import Link from "next/link";
import { LogOut, Settings, User } from "lucide-react";
import { signOut, useSession } from "next-auth/react";

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
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { LoadingButton } from "@/shared/ui/LoadingButton";
import { Skeleton } from "@/shared/ui/skeleton";

export function UserNav() {
  const { data: session, status } = useSession();
  const user = session?.user;
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

  if (status === "loading") {
    return <Skeleton className="h-9 w-9 rounded-full" />;
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
            <p className="text-sm leading-none font-medium">{name}</p>
            <p className="text-muted-foreground text-xs leading-none">{email}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem className="cursor-pointer" asChild>
            <Link href="/settings">
              <User className="mr-2" /> Профиль
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem className="cursor-pointer" asChild>
            <Link href="/settings">
              <Settings className="mr-2" /> Настройки
            </Link>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />

        <div className="">
          <Dialog>
            <DialogTrigger asChild>
              <DropdownMenuItem
                className="text-danger focus:bg-danger/20 focus:text-danger cursor-pointer"
                onSelect={(e) => e.preventDefault()}
              >
                <LogOut className="text-danger mr-2" />
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
