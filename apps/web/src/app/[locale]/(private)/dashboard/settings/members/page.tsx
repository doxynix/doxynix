import { getTranslations } from "next-intl/server";

import { createMetadata } from "@/shared/lib/metadata";

import { WorkspaceMembersPage } from "@/features/workspace/ui/workspace-members-page";

export const generateMetadata = createMetadata("members_title", "members_desc");

export default async function MembersPage() {
  const t = await getTranslations("Dashboard");

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h2 className="font-bold text-2xl tracking-tight">{t("settings_members_title")}</h2>
        <p className="text-muted-foreground text-sm">{t("settings_members_desc")}</p>
      </div>
      <WorkspaceMembersPage />
    </div>
  );
}
