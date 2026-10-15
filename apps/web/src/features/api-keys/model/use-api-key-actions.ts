import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { useTRPC } from "@/shared/api/trpc";
import { trackClientEvent } from "@/shared/lib/posthog-client";

export function useApiKeyActions() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const t = useTranslations("Dashboard");
  const invalidate = () => void queryClient.invalidateQueries(trpc.apikey.list.pathFilter());

  const create = useMutation(
    trpc.apikey.create.mutationOptions({
      onError: (err) => toast.error(err.message),
      onSuccess: () => {
        toast.success(t("settings_api_keys_created_toast_success"));
        invalidate();
        trackClientEvent("api_key_created");
      },
    }),
  );

  const revoke = useMutation(
    trpc.apikey.revoke.mutationOptions({
      onError: (err) => toast.error(err.message),
      onSuccess: () => {
        toast.success(t("settings_api_keys_revoked_toast_success"));
        invalidate();
        trackClientEvent("api_key_revoked");
      },
    }),
  );

  const update = useMutation(
    trpc.apikey.update.mutationOptions({
      onError: (err) => toast.error(err.message),
      onSuccess: () => {
        toast.success(t("settings_api_keys_updated_toast_success"));
        invalidate();
      },
    }),
  );

  return { create, revoke, update };
}
