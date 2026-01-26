import { getLocale } from "next-intl/server";

import { getServerAuthSession } from "@/shared/api/auth/auth-options";

import { redirect } from "@/i18n/routing";
import { ProfileCard } from "./profile-card";

export async function ProfileDataLoader() {
  const session = await getServerAuthSession();
  const locale = await getLocale();

  if (!session?.user) {
    redirect({ href: "/auth", locale });
    return null;
  }

  return <ProfileCard user={session.user} />;
}
