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
    const installationIdStr = params.installation_id?.trim();
    const stateFromUrl = params.state;

    if (installationIdStr == null || stateFromUrl == null || hasProcessed.current) return;
    if (!/^\d+$/.test(installationIdStr)) return;

    hasProcessed.current = true;

    mutate(
      { installationId: installationIdStr, state: stateFromUrl },
      {
        onError: () => {
          hasProcessed.current = false;
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
  }, [mutate, params.installation_id, params.state, utils.repo.getMyGithubRepos, setParams]);

  return null;
}
