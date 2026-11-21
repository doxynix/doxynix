import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { useTRPC } from "@/shared/api/trpc";
import { useErrorMessage } from "@/shared/i18n/use-error-message";
import { trackClientEvent } from "@/shared/lib/posthog-client";

export function useGithubInstall() {
  const trpc = useTRPC();
  const errorMessage = useErrorMessage();
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
          toast.error(errorMessage(error));
          return;
        }

        window.location.assign(data);
      })
      .catch((error: unknown) => {
        trackClientEvent("github_app_install_failed");
        toast.error(errorMessage(error));
      })
      .finally(() => {
        setIsLoading(false);
      });
  };

  return { install, isLoading };
}
