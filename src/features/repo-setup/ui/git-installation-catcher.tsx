"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

import { trpc } from "@/shared/api/trpc";
import { usePathname, useRouter } from "@/i18n/routing";

export function GitInstallationCatcher() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const utils = trpc.useUtils();

  const installationId = searchParams.get("installation_id");
  const saveInstall = trpc.repo.saveInstallation.useMutation();

  useEffect(() => {
    if (installationId != null) {
      saveInstall.mutate(
        { installationId: Number(installationId) },
        {
          onSuccess: () => {
            void utils.repo.getMyGithubRepos.invalidate();
            const params = new URLSearchParams(searchParams.toString());
            params.delete("installation_id");
            params.delete("setup_action");
            router.replace(`${pathname}?${params.toString()}`);
          },
        }
      );
    }
  }, [installationId, pathname, router, saveInstall, searchParams, utils.repo.getMyGithubRepos]);

  return null;
}
