"use client";

import { type ComponentType, useState } from "react";
import type { Route } from "next";
import { LogOut } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { Link, useRouter } from "@/shared/i18n/navigation";
import { useErrorMessage } from "@/shared/i18n/use-error-message";
import { authClient } from "@/shared/lib/auth-client";
import { useMounted } from "@/shared/lib/hooks/use-mounted";
import { AppButton } from "@/shared/ui/core/button";
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
import { DangerActionDialog } from "@/shared/ui/kit/danger-action-dialog";

export type UserMenuItem = {
  href: Route;
  icon?: ComponentType<{ className?: string }>;
  label: string;
  shortcut?: string;
};

type Props = {
  items: readonly UserMenuItem[];
};

export function UserMenu({ items }: Readonly<Props>) {
  const { data: session, isPending } = authClient.useSession();
  const isHydrated = useMounted();
  const router = useRouter();
  const user = session?.user ?? null;
  const tCommon = useTranslations("Common");
  const t = useTranslations("Auth");
  const errorMessage = useErrorMessage();

  const [loading, setLoading] = useState(false);
  const [signOutOpen, setSignOutOpen] = useState(false);

  async function handleSignOut() {
    setLoading(true);

    await authClient
      .signOut({
        fetchOptions: {
          onError: (ctx) => {
            toast.error(errorMessage(ctx.error));
          },
          onSuccess: () => {
            router.push("/auth");
          },
        },
      })
      .catch((error: unknown) => {
        toast.error(errorMessage(error));
      })
      .finally(() => {
        setLoading(false);
      });
  }

  if (!isHydrated || isPending) {
    return <Skeleton className="size-9 rounded-full" />;
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <AppButton
            className="rounded-full"
            size="icon"
            variant="ghost"
          >
            <AppAvatar
              alt={user?.name ?? tCommon("user")}
              className="size-9 border-0"
              fallbackClassName="text-xs"
              fallbackText={user?.name ?? user?.email ?? undefined}
              priority={true}
              src={user?.image}
            />
          </AppButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-56"
        >
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col gap-1">
              <p className="truncate font-medium text-sm">{user?.name}</p>
              <p className="truncate text-muted-foreground text-xs">{user?.email}</p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            {items.map((item) => (
              <DropdownMenuItem
                asChild
                className="group"
                key={item.href}
              >
                <Link
                  className="flex items-center"
                  href={item.href}
                >
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

          <DropdownMenuItem
            className="text-destructive focus:bg-destructive/20 focus:text-destructive"
            onSelect={() => setSignOutOpen(true)}
          >
            <LogOut className="text-destructive" />
            {t("logout")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DangerActionDialog
        confirmLabel={t("logout")}
        description={t("logout_confirmation_desc")}
        isLoading={loading}
        onConfirm={() => void handleSignOut()}
        onOpenChange={setSignOutOpen}
        open={signOutOpen}
        title={t("logout_title")}
      />
    </>
  );
}
