"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { useTRPC } from "@/shared/api/trpc";
import { Link, useRouter } from "@/shared/i18n/navigation";
import { authClient } from "@/shared/lib/auth-client";
import { setWorkspaceCookie } from "@/shared/lib/workspace-cookie";
import { AppButton } from "@/shared/ui/core/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/core/card";
import { Skeleton } from "@/shared/ui/core/skeleton";
import { ActionErrorAlert } from "@/shared/ui/kit/action-error-alert";
import { LoadingButton } from "@/shared/ui/kit/loading-button";

type Props = {
  token: string;
};

export function InvitePageCard({ token }: Readonly<Props>) {
  const trpc = useTRPC();
  const router = useRouter();
  const queryClient = useQueryClient();
  const t = useTranslations("Dashboard");
  const tCommon = useTranslations("Common");
  const { data: session, isPending: isSessionPending } = authClient.useSession();

  const [error, setError] = useState<unknown>(null);

  const preview = useQuery(trpc.workspace.previewInvite.queryOptions({ token }));
  const accept = useMutation(
    trpc.workspace.acceptInvite.mutationOptions({
      onError: (mutationError) => {
        setError(mutationError);
      },
      onSuccess: ({ workspaceId }) => {
        setWorkspaceCookie(workspaceId);
        queryClient.clear();
        toast.success(t("invite_page_joined"));
        router.replace("/dashboard");
      },
    }),
  );

  if (preview.isLoading || isSessionPending) {
    return (
      <div className="flex w-full max-w-md flex-col gap-3">
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-9 w-40" />
      </div>
    );
  }

  const workspaceName = preview.data?.workspaceName ?? "";
  const isValid = preview.data?.valid === true;
  const isAuthenticated = session?.user != null;

  if (!isValid) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{t("invite_page_title")}</CardTitle>
          <CardDescription>{t("invite_page_invalid")}</CardDescription>
        </CardHeader>
        <CardContent>
          <AppButton asChild>
            <Link href={isAuthenticated ? "/dashboard" : "/auth"}>{tCommon("back_home")}</Link>
          </AppButton>
        </CardContent>
      </Card>
    );
  }

  const signInHref = `/auth?next=${encodeURIComponent(`/invite/${token}`)}`;

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>{t("invite_page_title")}</CardTitle>
        <CardDescription>{t("invite_page_desc", { workspace: workspaceName })}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {error != null && (
          <ActionErrorAlert
            error={error}
            onDismiss={() => setError(null)}
          />
        )}

        {isAuthenticated ? (
          <LoadingButton
            className="w-fit gap-2"
            isLoading={accept.isPending}
            onClick={() => accept.mutate({ token })}
          >
            {t("invite_page_accept")}
          </LoadingButton>
        ) : (
          <AppButton
            asChild
            className="w-fit"
          >
            <Link href={signInHref}>{t("invite_page_sign_in")}</Link>
          </AppButton>
        )}
      </CardContent>
    </Card>
  );
}
