"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";

import { trpc } from "@/shared/api/trpc";
import { usePathname, useRouter } from "@/i18n/routing";

export function GitInstallationCatcher() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const utils = trpc.useUtils();

  const hasprocessed = useRef(false);

  const installationId = searchParams.get("installation_id");
  const saveInstall = trpc.repo.saveInstallation.useMutation();

  useEffect(() => {
    if (installationId == null || hasprocessed.current) return;

    hasprocessed.current = true;

    saveInstall.mutate(
      { installationId: Number(installationId) },
      {
        onError: () => {
          hasprocessed.current = false;
        },
        onSuccess: () => {
          void utils.repo.getMyGithubRepos.invalidate();

          const params = new URLSearchParams(searchParams.toString());
          params.delete("installation_id");
          params.delete("setup_action");

          const queryString = params.toString();
          const newUrl = queryString ? `${pathname}?${queryString}` : pathname;

          router.replace(newUrl);
        },
      }
    );
  }, [installationId, pathname, router, saveInstall, searchParams, utils.repo.getMyGithubRepos]);

  return null;
}
