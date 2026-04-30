"use client";

import { useState } from "react";
import { ExternalLinkIcon } from "lucide-react";
import { signIn } from "next-auth/react";
import { toast } from "sonner";

import { trpc, type LinkedAccounts, type LinkedUser } from "@/shared/api/trpc";
import { Button } from "@/shared/ui/core/button";
import { GitHubIcon } from "@/shared/ui/icons/github-icon";
import { GoogleIcon } from "@/shared/ui/icons/google-icon";
import { YandexIcon } from "@/shared/ui/icons/yandex-icon";
import { AppAvatar } from "@/shared/ui/kit/app-avatar";
import { AppTooltip } from "@/shared/ui/kit/app-tooltip";
import { DangerActionDialog } from "@/shared/ui/kit/danger-action-dialog";
import { ExternalLink } from "@/shared/ui/kit/external-link";
import { LoadingButton } from "@/shared/ui/kit/loading-button";

import { ConnectionCard } from "./connection-card";

type Props = {
  accounts: LinkedAccounts;
  user: LinkedUser | null;
};

const OAUTH_PROVIDERS = [
  {
    description: "Access your code and repositories.",
    icon: <GitHubIcon className="size-5" />,
    id: "github",
    manageUrl: "https://github.com/settings/applications",
    name: "GitHub",
  },
  {
    description: "Log in with your Google account.",
    icon: <GoogleIcon className="size-5" />,
    id: "google",
    manageUrl: "https://myaccount.google.com/permissions",
    name: "Google",
  },
  {
    description: "Secure login via Yandex ID.",
    icon: <YandexIcon className="size-5" />,
    id: "yandex",
    manageUrl: "https://passport.yandex.ru/profile/access",
    name: "Yandex",
  },
] as const;

export function AuthProvidersList({ accounts, user }: Readonly<Props>) {
  const [disconnectingProvider, setDisconnectingProvider] = useState<null | string>(null);
  const [loadingProvider, setLoadingProvider] = useState<null | string>(null);

  const canDisconnectAny = accounts.length > 1 || (user?.email != null && user?.emailVerified != null);

  const utils = trpc.useUtils();
  const disconnect = trpc.user.disconnectAccount.useMutation({
    onError: (err) => toast.error(err.message),
    onSuccess: () => {
      toast.success("Account unlinked successfully");
      void utils.user.getLinkedAccounts.invalidate();
      setDisconnectingProvider(null);
    },
  });

  const handleConnect = async (providerId: string) => {
    try {
      setLoadingProvider(providerId);
      await signIn(providerId, { callbackUrl: window.location.href });
    } finally {
      setLoadingProvider(null);
    }
  };

  return (
    <div className="grid gap-3">
      {OAUTH_PROVIDERS.map((provider) => {
        const linked = accounts.find((a) => a.provider === provider.id);
        const identity = linked?.email ?? linked?.name ?? user?.email;
        const isConnected = linked != null;

        const customIcon =
          linked?.image != null ? (
            <AppAvatar alt={provider.name} src={linked.image} />
          ) : (
            provider.icon
          );

        return (
          <ConnectionCard
            key={provider.id}
            action={
              <ProviderAction
                canDisconnectAny={canDisconnectAny}
                isConnectingThis={loadingProvider === provider.id}
                isDisconnecting={disconnectingProvider === provider.id}
                isLoadingAny={loadingProvider !== null}
                isMutationPending={disconnect.isPending}
                linked={linked}
                provider={provider}
                onConnect={() => void handleConnect(provider.id)}
                onDisconnect={(id) => disconnect.mutate({ provider: id })}
                onOpenChange={(open) => setDisconnectingProvider(open ? provider.id : null)}
              />
            }
            description={isConnected ? `Connected as ${identity}` : provider.description}
            icon={customIcon}
            status={isConnected ? "Connected" : undefined}
            title={provider.name}
          />
        );
      })}
    </div>
  );
}

type OAuthProvider = (typeof OAUTH_PROVIDERS)[number];

type LinkedAccount = LinkedAccounts[number];

type ProviderActionProps = {
  canDisconnectAny: boolean;
  isConnectingThis: boolean;
  isDisconnecting: boolean;
  isLoadingAny: boolean;
  isMutationPending: boolean;
  linked?: LinkedAccount;
  onConnect: (id: string) => void;
  onDisconnect: (id: string) => void;
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
  const isConnected = linked != null;

  if (!isConnected) {
    return (
      <LoadingButton
        disabled={isLoadingAny}
        isLoading={isConnectingThis}
        size="sm"
        variant="outline"
        onClick={() => onConnect(provider.id)}
      >
        Connect
      </LoadingButton>
    );
  }

  if (!canDisconnectAny) {
    return (
      <AppTooltip content="You cannot delete your last connection">
        <div>
          <Button disabled size="sm" variant="destructive">
            Disconnect
          </Button>
        </div>
      </AppTooltip>
    );
  }

  return (
    <DangerActionDialog
      confirmLabel="Disconnect"
      description={`Are you sure you want to unlink your ${provider.name} account?`}
      destructiveAlertContent={
        <div className="space-y-2">
          <p>This will remove your ability to sign in using this method.</p>
        </div>
      }
      isLoading={isMutationPending}
      open={isDisconnecting}
      successAlertContent={
        <p>
          To fully revoke Doxynix permissions on the {provider.name} side, visit your{" "}
          <ExternalLink
            href={provider.manageUrl}
            className="inline-flex items-center gap-1 underline hover:no-underline"
          >
            {provider.name} Settings <ExternalLinkIcon className="size-3" />
          </ExternalLink>
        </p>
      }
      successAlertTitle="Pro-tip"
      title={`Disconnect ${provider.name}`}
      trigger={
        <Button size="sm" variant="destructive">
          Disconnect
        </Button>
      }
      onConfirm={() => onDisconnect(provider.id)}
      onOpenChange={onOpenChange}
    />
  );
}
