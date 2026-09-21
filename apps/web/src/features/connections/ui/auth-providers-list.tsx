"use client";

import { type JSX, useState } from "react";
import { ExternalLinkIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { trpc } from "@/shared/api/trpc";
import { authClient } from "@/shared/lib/auth-client";
import { AppButton } from "@/shared/ui/core/button";
import { GitHubIcon } from "@/shared/ui/icons/github-icon";
import { YandexIcon } from "@/shared/ui/icons/yandex-icon";
import { AppAvatar } from "@/shared/ui/kit/app-avatar";
import { AppTooltip } from "@/shared/ui/kit/app-tooltip";
import { DangerActionDialog } from "@/shared/ui/kit/danger-action-dialog";
import { ExternalLink } from "@/shared/ui/kit/external-link";
import { LoadingButton } from "@/shared/ui/kit/loading-button";

import { ConnectionCard } from "@/entities/connection/ui/connection-card";
import type { LinkedAccounts, LinkedUser } from "@/entities/user/model/user.types";

type Props = {
  accounts: LinkedAccounts;
  user: LinkedUser | null;
};

type OAuthProvider = {
  description: string;
  icon: JSX.Element;
  id: "github" | "yandex";
  manageUrl: string;
  name: string;
};

export function AuthProvidersList({ accounts, user }: Readonly<Props>) {
  const t = useTranslations("Dashboard");
  const [disconnectingProvider, setDisconnectingProvider] = useState<null | string>(null);
  const [loadingProvider, setLoadingProvider] = useState<null | string>(null);

  const canDisconnectAny = accounts.length > 1 || (user?.email != null && user.emailVerified);

  const OAUTH_PROVIDERS: readonly OAuthProvider[] = [
    {
      description: t("settings_auth_github_desc"),
      icon: <GitHubIcon className="size-5" />,
      id: "github",
      manageUrl: "https://github.com/settings/applications",
      name: t("settings_auth_github_name"),
    },
    {
      description: t("settings_auth_yandex_desc"),
      icon: <YandexIcon className="size-5" />,
      id: "yandex",
      manageUrl: "https://passport.yandex.ru/profile/access",
      name: t("settings_auth_yandex_name"),
    },
  ] as const;

  const utils = trpc.useUtils();
  const disconnect = trpc.user.disconnectAccount.useMutation({
    onError: (err) => toast.error(err.message),
    onSuccess: () => {
      toast.success(t("settings_auth_unlink_success"));
      void utils.user.getLinkedAccounts.invalidate();
      setDisconnectingProvider(null);
    },
  });

  const handleConnect = async (provider: "github" | "yandex") => {
    try {
      setLoadingProvider(provider);
      await authClient.signIn.social({
        callbackURL: window.location.href,
        provider,
      });
    } catch {
      toast.error(t("settings_auth_link_failed"));
    } finally {
      setLoadingProvider(null);
    }
  };

  return (
    <div className="grid gap-3">
      {OAUTH_PROVIDERS.map((provider) => {
        const linked = accounts.find((a: { provider: string }) => a.provider === provider.id);
        const identity = linked?.email ?? linked?.name ?? user?.email;
        const isConnected = linked != null;

        const customIcon =
          linked?.image != null ? (
            <AppAvatar
              alt={provider.name}
              fallbackText={provider.name}
              src={linked.image}
            />
          ) : (
            provider.icon
          );

        return (
          <ConnectionCard
            action={
              <ProviderAction
                canDisconnectAny={canDisconnectAny}
                isConnectingThis={loadingProvider === provider.id}
                isDisconnecting={disconnectingProvider === provider.id}
                isLoadingAny={loadingProvider !== null}
                isMutationPending={disconnect.isPending}
                linked={linked}
                onConnect={() => void handleConnect(provider.id)}
                onDisconnect={(id) => disconnect.mutate({ provider: id })}
                onOpenChange={(open) => setDisconnectingProvider(open ? provider.id : null)}
                provider={provider}
              />
            }
            description={
              isConnected
                ? t("settings_auth_connected_as", { identity: identity ?? "" })
                : provider.description
            }
            icon={customIcon}
            key={provider.id}
            status={isConnected ? t("settings_auth_status_connected") : undefined}
            title={provider.name}
          />
        );
      })}
    </div>
  );
}

type LinkedAccount = LinkedAccounts[number];

type AuthProviderId = OAuthProvider["id"];

type ProviderActionProps = {
  canDisconnectAny: boolean;
  isConnectingThis: boolean;
  isDisconnecting: boolean;
  isLoadingAny: boolean;
  isMutationPending: boolean;
  linked?: LinkedAccount;
  onConnect: (id: AuthProviderId) => void;
  onDisconnect: (id: AuthProviderId) => void;
  onOpenChange: (open: boolean) => void;
  provider: OAuthProvider;
};

function ProviderAction({
  canDisconnectAny,
  isConnectingThis,
  isDisconnecting,
  isLoadingAny,
  isMutationPending,
  linked,
  onConnect,
  onDisconnect,
  onOpenChange,
  provider,
}: Readonly<ProviderActionProps>) {
  const tCommon = useTranslations("Common");
  const t = useTranslations("Dashboard");
  const isConnected = linked != null;

  if (!isConnected) {
    return (
      <LoadingButton
        disabled={isLoadingAny}
        isLoading={isConnectingThis}
        onClick={() => onConnect(provider.id)}
        size="sm"
        variant="outline"
      >
        {tCommon("connect")}
      </LoadingButton>
    );
  }

  if (!canDisconnectAny) {
    return (
      <AppTooltip content={t("settings_auth_cannot_disconnect_last")}>
        <div>
          <AppButton
            disabled
            size="sm"
            variant="destructive"
          >
            {tCommon("disconnect")}
          </AppButton>
        </div>
      </AppTooltip>
    );
  }

  return (
    <DangerActionDialog
      confirmLabel={tCommon("disconnect")}
      description={t("settings_auth_disconnect_confirmation", { name: provider.name })}
      destructiveAlertContent={
        <div className="flex flex-col gap-2">
          <p>{t("settings_auth_disconnect_alert")}</p>
        </div>
      }
      isLoading={isMutationPending}
      onConfirm={() => onDisconnect(provider.id)}
      onOpenChange={onOpenChange}
      open={isDisconnecting}
      successAlertContent={
        <p>
          {t("settings_auth_disconnect_protip_pre")}{" "}
          <ExternalLink
            className="inline-flex items-center gap-1 underline hover:no-underline"
            href={provider.manageUrl}
          >
            {t("settings_auth_disconnect_protip_link", { name: provider.name })}{" "}
            <ExternalLinkIcon className="size-3" />
          </ExternalLink>
        </p>
      }
      successAlertTitle={t("settings_auth_disconnect_protip_title")}
      title={t("settings_auth_disconnect_title", { name: provider.name })}
      trigger={
        <AppButton
          size="sm"
          variant="destructive"
        >
          {tCommon("disconnect")}
        </AppButton>
      }
    />
  );
}
