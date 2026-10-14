"use client";

import { useState, useSyncExternalStore } from "react";
import { LogOut } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { useNavLabels } from "@/shared/config/navigation-labels";
import { Link, useRouter } from "@/shared/i18n/navigation";
import { authClient } from "@/shared/lib/auth-client";
import { AppButton } from "@/shared/ui/core/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/core/dropdown-menu";
import { Skeleton } from "@/shared/ui/core/skeleton";
import { AppAvatar } from "@/shared/ui/kit/app-avatar";
import { DangerActionDialog } from "@/shared/ui/kit/danger-action-dialog";

const noopSubscribe = () => () => {};
const getHydratedSnapshot = () => true;
const getServerHydratedSnapshot = () => false;

export function AdminUserNav() {
  const { data: session, isPending } = authClient.useSession();
  const isHydrated = useSyncExternalStore(
    noopSubscribe,
    getHydratedSnapshot,
    getServerHydratedSnapshot,
  );
  const router = useRouter();
  const t = useTranslations("Auth");
  const tCommon = useTranslations("Common");
  const navLabels = useNavLabels();

  const user = session?.user ?? null;
  const [loading, setLoading] = useState(false);
  const [signOutOpen, setSignOutOpen] = useState(false);

  async function handleSignOut() {
    setLoading(true);

    await authClient
      .signOut({
        fetchOptions: {
          onError: (ctx) => {
            toast.error(ctx.error.message);
          },
          onSuccess: () => {
            router.push("/auth");
          },
        },
      })
      .catch((error: unknown) => {
        toast.error(error instanceof Error ? error.message : t("sign_out_failed"));
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
            className="flex items-center gap-3"
            size="icon"
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

          <DropdownMenuItem asChild>
            <Link href="/dashboard">{navLabels.dashboard}</Link>
          </DropdownMenuItem>

          <DropdownMenuItem asChild>
            <Link href="/dashboard/settings/profile">{navLabels.profile}</Link>
          </DropdownMenuItem>

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
