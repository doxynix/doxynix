import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { useTRPC } from "@/shared/api/trpc";
import { useRouter } from "@/shared/i18n/navigation";
import { trackClientEvent } from "@/shared/lib/posthog-client";

export function useRepoActions() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const t = useTranslations("Dashboard");
  const router = useRouter();

  const invalidate = () => {
    void queryClient.invalidateQueries(trpc.repo.getAll.pathFilter());
    void queryClient.invalidateQueries(trpc.repo.getSlim.pathFilter());
    void queryClient.invalidateQueries(trpc.analytics.getDashboardStats.pathFilter());
  };

  const create = useMutation(
    trpc.repo.create.mutationOptions({
      onError: (error) => toast.error(error.message),
      onSuccess: (data) => {
        toast.success(t("repo_added_toast_success"), {
          action: {
            label: t("view"),
            onClick: () => router.push(`/dashboard/repo/${data.repo.owner}/${data.repo.name}`),
          },
        });
        invalidate();
        trackClientEvent("repo_added");
      },
    }),
  );

  const deleteAll = useMutation(
    trpc.repo.deleteAll.mutationOptions({
      onError: (error) => toast.error(error.message),
      onSuccess: () => {
        toast.success(t("settings_danger_delete_all_repos_toast_success"));
        invalidate();
        trackClientEvent("all_repos_deleted");
      },
    }),
  );

  const deleteByOwner = useMutation(
    trpc.repo.deleteByOwner.mutationOptions({
      onError: (error) => toast.error(error.message),
      onSuccess: (data, variables) => {
        toast.success(
          t("settings_danger_delete_repos_by_owner_toast_success", {
            count: data.count,
            owner: variables.owner,
          }),
        );
        invalidate();
        trackClientEvent("repos_by_owner_deleted");
      },
    }),
  );

  const deleteRepo = useMutation(
    trpc.repo.delete.mutationOptions({
      onError: (error) => toast.error(error.message),
      onSuccess: () => {
        toast.success(t("settings_danger_delete_repo_toast_success"));
        invalidate();
        trackClientEvent("repo_deleted");
      },
    }),
  );

  return { create, deleteAll, deleteByOwner, deleteRepo, invalidate };
}
