import { useTranslations } from "next-intl";
import posthog from "posthog-js";
import { toast } from "sonner";

import { trpc } from "@/shared/api/trpc";

export function useRepoActions() {
  const utils = trpc.useUtils();
  const t = useTranslations("Dashboard");

  const invalidate = () => {
    void utils.repo.getAll.invalidate();
    void utils.analytics.getDashboardStats.invalidate();
  };

  const create = trpc.repo.create.useMutation({
    onError: (err) => toast.error(err.message),
    onSuccess: async (data) => {
      toast.success(t("repo_added_toast_success"));
      void invalidate();
      posthog.capture("repo_added", {
        repo_name: data.repo.name,
        repo_owner: data.repo.owner,
        repo_url: data.repo.url,
      });
    },
  });

  const deleteAll = trpc.repo.deleteAll.useMutation({
    onError: (err) => toast.error(err.message),
    onSuccess: async () => {
      toast.success(t("settings_danger_delete_all_repos_toast_success"));
      void invalidate();
      posthog.capture("all_repos_deleted");
    },
  });

  return { create, deleteAll, invalidate };
}
