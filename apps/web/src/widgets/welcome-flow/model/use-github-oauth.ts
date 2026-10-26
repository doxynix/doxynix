import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { useRouter } from "@/shared/i18n/navigation";
import { authClient } from "@/shared/lib/auth-client";
import { trackClientEvent } from "@/shared/lib/posthog-client";

export function useGithubOAuth() {
  const t = useTranslations("Welcome");
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const signIn = () => {
    setIsLoading(true);
    trackClientEvent("github_oauth_started");

    void authClient.signIn
      .social({
        callbackURL: "/welcome",
        provider: "github",
      })
      .then(({ error }) => {
        if (error != null) {
          trackClientEvent("github_oauth_failed");
          toast.error(t("github_error"));
          return;
        }

        router.refresh();
      })
      .catch(() => {
        trackClientEvent("github_oauth_failed");
        toast.error(t("github_error"));
      })
      .finally(() => {
        setIsLoading(false);
      });
  };

  return { isLoading, signIn };
}
