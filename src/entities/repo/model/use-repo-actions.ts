import { useTranslations } from "next-intl";
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
    onSuccess: async () => {
      toast.success(t("repo_added_toast_success"));
      void invalidate();
    },
  });

  const deleteAll = trpc.repo.deleteAll.useMutation({
    onError: (err) => toast.error(err.message),
    onSuccess: async () => {
      toast.success(t("settings_danger_delete_all_repos_toast_success"));
      void invalidate();
    },
  });

  return { create, deleteAll, invalidate };
}
