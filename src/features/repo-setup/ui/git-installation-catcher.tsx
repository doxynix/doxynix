"use client";

import { useEffect, useRef } from "react";
import { parseAsString, useQueryStates } from "nuqs";

import { trpc } from "@/shared/api/trpc";

export function GitInstallationCatcher() {
  const [params, setParams] = useQueryStates({
    installation_id: parseAsString,
    setup_action: parseAsString,
    state: parseAsString,
  });

  const utils = trpc.useUtils();
  const hasProcessed = useRef(false);
  const { mutate } = trpc.repo.saveInstallation.useMutation();

  useEffect(() => {
    if (hasProcessed.current) return;

    const installationIdStr = params.installation_id?.trim();
    const stateFromUrl = params.state;

    if (installationIdStr == null && stateFromUrl == null) return;

    if (installationIdStr == null || stateFromUrl == null || !/^\d+$/.test(installationIdStr)) {
      void setParams({
        installation_id: null,
        setup_action: null,
        state: null,
      });
      return;
    }

    hasProcessed.current = true;

    mutate(
      { installationId: installationIdStr, state: stateFromUrl },
      {
        onError: () => {
          hasProcessed.current = false;
          void setParams({
            installation_id: null,
            setup_action: null,
            state: null,
          });
        },
        onSuccess: () => {
          void utils.repo.getMyGithubRepos.invalidate();

          void setParams({
            installation_id: null,
            setup_action: null,
            state: null,
          });
        },
      }
    );
  }, [params.installation_id, params.state, mutate, utils.repo.getMyGithubRepos, setParams]);

  return null;
}
