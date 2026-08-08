import { useTranslations } from "next-intl";
import posthog from "posthog-js";
import { toast } from "sonner";

import { trpc } from "@/shared/api/trpc";

export function useApiKeyActions() {
  const utils = trpc.useUtils();
  const t = useTranslations("Dashboard");
  const invalidate = () => void utils.apikey.list.invalidate();

  const create = trpc.apikey.create.useMutation({
    onError: (err) => toast.error(err.message),
    onSuccess: () => {
      toast.success(t("settings_api_keys_created_toast_success"));
      invalidate();
      posthog.capture("api_key_created");
    },
  });

  const revoke = trpc.apikey.revoke.useMutation({
    onError: (err) => toast.error(err.message),
    onSuccess: () => {
      toast.success(t("settings_api_keys_revoked_toast_success"));
      invalidate();
      posthog.capture("api_key_revoked");
    },
  });

  const update = trpc.apikey.update.useMutation({
    onError: (err) => toast.error(err.message),
    onSuccess: () => {
      toast.success(t("settings_api_keys_updated_toast_success"));
      invalidate();
    },
  });

  return { create, revoke, update };
}
