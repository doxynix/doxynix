import { Suspense } from "react";
import { getTranslations } from "next-intl/server";

import { createMetadata } from "@/shared/lib/metadata";
import { LanguageSwitcher } from "@/shared/ui/kit/language-switcher";

import { ProfileSkeleton } from "@/features/profile";

import { ProfileDataLoader } from "./_components/profile-data-loader";

export const generateMetadata = createMetadata("profile_title", "profile_desc");

export default async function ProfilePage() {
  const t = await getTranslations("Dashboard");

  return (
    <div className="flex w-full max-w-2xl flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-bold tracking-tight">{t("settings_profile_title")}</h2>
        <p className="text-muted-foreground text-sm">{t("settings_profile_desc")}</p>
      </div>
      <Suspense fallback={<ProfileSkeleton />}>
        <ProfileDataLoader />
      </Suspense>
      <LanguageSwitcher />
    </div>
  );
}
