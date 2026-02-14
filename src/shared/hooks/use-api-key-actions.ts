import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { trpc } from "@/shared/api/trpc";

export function useApiKeyActions() {
  const utils = trpc.useUtils();
  const t = useTranslations("Dashboard");
  const invalidate = () => void utils.apikey.list.invalidate();

  const create = trpc.apikey.create.useMutation({
    onSuccess: () => {
      toast.success(t("settings_api_keys_created_toast_success"));
      invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const revoke = trpc.apikey.revoke.useMutation({
    onSuccess: () => {
      toast.success(t("settings_api_keys_revoked_toast_success"));
      invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const update = trpc.apikey.update.useMutation({
    onSuccess: () => {
      toast.success(t("settings_api_keys_updated_toast_success"));
      invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  return { create, revoke, update };
}
