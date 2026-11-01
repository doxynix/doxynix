import { getTranslations } from "next-intl/server";

import { Card, CardDescription, CardHeader, CardTitle } from "@/shared/ui/core/card";

import { DeleteAccountDialog } from "./delete-account-dialog";

export async function DeleteAccountCard() {
  const t = await getTranslations("Dashboard");

  return (
    <Card className="border-destructive">
      <CardHeader>
        <CardTitle>{t("settings_danger_delete_account_title")}</CardTitle>
        <CardDescription className="mb-4">
          {t("settings_danger_delete_account_desc")}{" "}
        </CardDescription>
        <DeleteAccountDialog />
      </CardHeader>
    </Card>
  );
}
