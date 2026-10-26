import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { useTRPC } from "@/shared/api/trpc";
import { trackClientEvent } from "@/shared/lib/posthog-client";

export function useGithubInstall() {
  const trpc = useTRPC();
  const t = useTranslations("Welcome");
  const [isLoading, setIsLoading] = useState(false);
  const { refetch } = useQuery(
    trpc.githubApp.getGithubInstallUrl.queryOptions(
      {},
      {
        enabled: false,
      },
    ),
  );

  const install = () => {
    setIsLoading(true);
    trackClientEvent("github_app_install_started");

    void refetch()
      .then(({ data, error }) => {
        if (error != null || data == null) {
          trackClientEvent("github_app_install_failed");
          toast.error(t("github_error"));
          return;
        }

        window.location.assign(data);
      })
      .catch(() => {
        trackClientEvent("github_app_install_failed");
        toast.error(t("github_error"));
      })
      .finally(() => {
        setIsLoading(false);
      });
  };

  return { install, isLoading };
}
