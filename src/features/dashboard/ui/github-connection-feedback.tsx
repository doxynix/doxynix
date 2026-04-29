"use client";

import { useEffect } from "react";
import { parseAsString, useQueryState } from "nuqs";
import { posthog } from "posthog-js";
import { toast } from "sonner";

import { GitHubIcon } from "@/shared/ui/icons/github-icon";

export function GithubConnectionFeedback() {
  const [success, setSuccess] = useQueryState("success", parseAsString);
  const [error, setError] = useQueryState("error", parseAsString);

  useEffect(() => {
    if (success === "github_connected") {
      toast("GitHub account connected", {
        description: "Your repositories are now being synced.",
        duration: 5000,
        icon: <GitHubIcon />,
      });

      posthog.capture("github_integration_success");

      void setSuccess(null, { shallow: true });
    }

    if (error != null) {
      const message =
        error === "setup_failed"
          ? "Failed to connect GitHub. Please try again."
          : "Missing setup parameters.";

      toast.error("Connection Error", { description: message, duration: 5000 });

      posthog.capture("github_integration_failed", { reason: error });

      void setError(null, { shallow: true });
    }
  }, [success, error, setSuccess, setError]);

  return null;
}
