"use client";

import { useState } from "react";
import { Route } from "next";
import Link from "next/link";
import { LogOut } from "lucide-react";
import { User } from "next-auth";
import { signOut } from "next-auth/react";

import { userNavMenu } from "@/shared/constants/navigation";
import { getInitials } from "@/shared/lib/get-initials";
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
import { LoadingButton } from "@/shared/ui/kit/loading-button";

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
      await signOut({ callbackUrl: "/auth" });
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
            <p className="truncate text-sm font-medium">{name}</p>
            <p className="text-muted-foreground truncate text-xs">{email}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          {userNavMenu.map((item) => (
            <DropdownMenuItem key={item.href} asChild>
              <Link href={item.href as Route} className="flex cursor-pointer items-center">
                <item.icon />
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
                Log out
              </DropdownMenuItem>
            </DialogTrigger>

            <DialogContent className="sm:max-w-105">
              <DialogHeader>
                <DialogTitle> Sign out</DialogTitle>
                <DialogDescription>Are you sure you want to log out?</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="flex justify-end gap-2">
                  <DialogClose asChild>
                    <Button className="cursor-pointer" variant="outline" disabled={loading}>
                      Cancel
                    </Button>
                  </DialogClose>
                  <LoadingButton
                    variant="destructive"
                    disabled={loading}
                    className="cursor-pointer"
                    onClick={handleSignOut}
                    isLoading={loading}
                    loadingText="Logout..."
                  >
                    Log out
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
