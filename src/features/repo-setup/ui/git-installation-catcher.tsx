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
  const { mutate } = trpc.repo.saveInstallation.useMutation();
  const invalidateMyRepos = utils.repo.getMyGithubRepos.invalidate;

  useEffect(() => {
    if (installationId == null || hasprocessed.current) return;

    const parsedId = Number(installationId);
    if (!Number.isInteger(parsedId) || parsedId <= 0) return;

    hasprocessed.current = true;

    mutate(
      { installationId: parsedId },
      {
        onError: () => {
          hasprocessed.current = false;
        },
        onSuccess: () => {
          void invalidateMyRepos();

          const params = new URLSearchParams(searchParams.toString());
          params.delete("installation_id");
          params.delete("setup_action");

          const queryString = params.toString();
          const newUrl = queryString ? `${pathname}?${queryString}` : pathname;

          router.replace(newUrl);
        },
      }
    );
  }, [installationId, pathname, router, searchParams, mutate, invalidateMyRepos]);
  return null;
}
