"use client";

import { useState } from "react";
import type { Route } from "next";
import { LogOut } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { userNavMenu } from "@/shared/constants/navigation";
import { Link, useRouter } from "@/shared/i18n/navigation";
import { authClient } from "@/shared/lib/auth-client";
import { AppButton } from "@/shared/ui/core/button";
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
import { AppAvatar } from "@/shared/ui/kit/app-avatar";
import { LoadingButton } from "@/shared/ui/kit/loading-button";

export function UserNav() {
  const { data: session, isPending } = authClient.useSession();
  const router = useRouter();
  const user = session?.user ?? null;
  const tCommon = useTranslations("Common");
  const t = useTranslations("Auth");

  const avatar = user?.image;
  const name = user?.name;
  const email = user?.email;
  const [loading, setLoading] = useState(false);

  async function handleSignOut() {
    try {
      setLoading(true);
      await authClient.signOut({
        fetchOptions: {
          onError: (ctx) => {
            toast.error(ctx.error.message);
          },
          onSuccess: () => {
            router.push("/auth");
          },
        },
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to sign out");
    } finally {
      setLoading(false);
    }
  }

  if (isPending) {
    return <Skeleton className="size-9 rounded-full" />;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <AppButton className="flex cursor-pointer items-center gap-3" size="icon">
          <AppAvatar
            alt={user?.name ?? "User"}
            className="size-9 border-0"
            fallbackClassName="text-xs"
            fallbackText={user?.name ?? user?.email ?? undefined}
            priority={true}
            src={avatar}
          />
        </AppButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col gap-1">
            <p className="truncate font-medium text-sm">{name}</p>
            <p className="truncate text-muted-foreground text-xs">{email}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          {userNavMenu.map((item) => (
            <DropdownMenuItem asChild className="group" key={item.href}>
              <Link className="flex items-center" href={item.href as Route}>
                {item.icon != null && <item.icon />}
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
              className="text-destructive focus:bg-destructive/20 focus:text-destructive"
              onSelect={(e) => e.preventDefault()}
            >
              <LogOut className="text-destructive" />
              {t("logout")}
            </DropdownMenuItem>
          </DialogTrigger>

          <DialogContent className="sm:max-w-105">
            <DialogHeader>
              <DialogTitle>{t("logout_title")}</DialogTitle>
              <DialogDescription>{t("logout_confirmation_desc")}</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-4">
              <div className="flex justify-end gap-2">
                <DialogClose asChild>
                  <AppButton className="cursor-pointer" disabled={loading} variant="outline">
                    {tCommon("cancel")}
                  </AppButton>
                </DialogClose>
                <LoadingButton
                  className="cursor-pointer"
                  disabled={loading}
                  isLoading={loading}
                  loadingText="Logout..."
                  onClick={() => void handleSignOut()}
                  variant="destructive"
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
