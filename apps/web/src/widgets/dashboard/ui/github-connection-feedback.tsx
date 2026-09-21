"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { parseAsString, useQueryState } from "nuqs";
import { posthog } from "posthog-js";
import { toast } from "sonner";

import { GitHubIcon } from "@/shared/ui/icons/github-icon";

export function GithubConnectionFeedback() {
  const t = useTranslations("Dashboard");
  const [success, setSuccess] = useQueryState("success", parseAsString);
  const [error, setError] = useQueryState("error", parseAsString);

  useEffect(() => {
    if (success === "github_connected") {
      toast(t("github_connected_title"), {
        description: t("github_connected_desc"),
        duration: 5000,
        icon: <GitHubIcon />,
      });

      posthog.capture("github_integration_success");

      void setSuccess(null);
    }

    if (error != null) {
      const message =
        error === "setup_failed" ? t("github_connect_failed") : t("github_missing_params");

      toast.error(t("github_connection_error"), { description: message, duration: 5000 });

      posthog.capture("github_integration_failed", { reason: error });

      void setError(null);
    }
  }, [success, error, setSuccess, setError, t]);

  return null;
}
