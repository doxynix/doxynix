import { getTranslations } from "next-intl/server";

import { Card, CardDescription, CardTitle } from "@/shared/ui/core/card";

import { DeleteAccountDialog } from "./delete-account-dialog";

export async function DeleteAccountCard() {
  const t = await getTranslations("Dashboard");

  return (
    <Card
      className="items-center"
      size="row"
      tone="danger"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <CardTitle className="text-sm">
          {t("settings_danger_delete_account_dialog_title")}
        </CardTitle>
        <CardDescription className="text-xs leading-5">
          {t("settings_danger_delete_account_desc")}
        </CardDescription>
      </div>
      <DeleteAccountDialog />
    </Card>
  );
}
