import { useTranslations } from "next-intl";
import posthog from "posthog-js";
import { toast } from "sonner";

import { trpc } from "@/shared/api/trpc";
import { useRouter } from "@/i18n/routing";

export function useRepoActions() {
  const utils = trpc.useUtils();
  const t = useTranslations("Dashboard");
  const router = useRouter();

  const invalidate = () => {
    void utils.repo.getAll.invalidate();
    void utils.repo.getSlim.invalidate();
    void utils.analytics.getDashboardStats.invalidate();
  };

  const create = trpc.repo.create.useMutation({
    onError: (err) => toast.error(err.message),
    onSuccess: (data) => {
      toast.success(t("repo_added_toast_success"), {
        action: {
          label: "View",
          onClick: () => router.push(`/dashboard/repo/${data.repo.owner}/${data.repo.name}`),
        },
      });
      invalidate();
      posthog.capture("repo_added");
    },
  });

  const deleteAll = trpc.repo.deleteAll.useMutation({
    onError: (err) => toast.error(err.message),
    onSuccess: () => {
      toast.success(t("settings_danger_delete_all_repos_toast_success"));
      invalidate();
      posthog.capture("all_repos_deleted");
    },
  });

  return { create, deleteAll, invalidate };
}
